package services

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/jpeg"
	"sort"
	"syscall"
	"unsafe"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"golang.org/x/sys/windows"
)

type WindowService struct {
	reset      bool
	winapi     *winAPI
	windowMode bool
}

type MonitorInfoEx struct {
	CbSize    uint32
	RcMonitor windows.Rect
	RcWork    windows.Rect
	DwFlags   uint32
	Device    [32]uint16 // Display device name (WCHAR[32])
}

// Monitor represents a display monitor with its properties.
type Monitor struct {
	Name    string // Display name (e.g., "[1] 1920x1080")
	Width   int    // Width of the monitor
	Height  int    // Height of the monitor
	X       int    // X-coordinate of the monitor's position
	Y       int    // Y-coordinate of the monitor's position
	Preview string // Base64-encoded image preview of the monitor
}

type winAPI struct {
	user32                 *windows.LazyDLL
	gdi32                  *windows.LazyDLL
	dwmapi                 *windows.LazyDLL
	getDC                  *windows.LazyProc
	releaseDC              *windows.LazyProc
	createCompatibleDC     *windows.LazyProc
	createCompatibleBitmap *windows.LazyProc
	selectObject           *windows.LazyProc
	bitBlt                 *windows.LazyProc
	deleteDC               *windows.LazyProc
	deleteObject           *windows.LazyProc
	getDIBits              *windows.LazyProc
	dwmGetWindowAttribute  *windows.LazyProc
}

// Load GetMonitorInfo from user32.dll
var (
	user32Window            = syscall.NewLazyDLL("user32.dll")
	procEnumDisplayMonitors = user32Window.NewProc("EnumDisplayMonitors")
	procGetMonitorInfo      = user32Window.NewProc("GetMonitorInfoW")
)

// NewWindowService creates a new WindowService
func NewWindowService(windowMode bool) *WindowService {
	// Create a new WindowService
	ws := &WindowService{
		winapi: &winAPI{
			user32: windows.NewLazySystemDLL("user32.dll"),
			gdi32:  windows.NewLazySystemDLL("gdi32.dll"),
			dwmapi: windows.NewLazySystemDLL("dwmapi.dll"),
		},
		windowMode: windowMode,
	}
	ws.winapi.getDC = ws.winapi.user32.NewProc("GetDC")
	ws.winapi.releaseDC = ws.winapi.user32.NewProc("ReleaseDC")
	ws.winapi.createCompatibleDC = ws.winapi.gdi32.NewProc("CreateCompatibleDC")
	ws.winapi.createCompatibleBitmap = ws.winapi.gdi32.NewProc("CreateCompatibleBitmap")
	ws.winapi.selectObject = ws.winapi.gdi32.NewProc("SelectObject")
	ws.winapi.bitBlt = ws.winapi.gdi32.NewProc("BitBlt")
	ws.winapi.deleteDC = ws.winapi.gdi32.NewProc("DeleteDC")
	ws.winapi.deleteObject = ws.winapi.gdi32.NewProc("DeleteObject")
	ws.winapi.getDIBits = ws.winapi.gdi32.NewProc("GetDIBits")
	ws.winapi.dwmGetWindowAttribute = ws.winapi.dwmapi.NewProc("DwmGetWindowAttribute")

	return ws
}

// GetMonitors retrieves the list of monitors connected to the system (with a small preview of each one).
func (ws *WindowService) GetMonitors() []Monitor {
	return ws.listMonitors(true)
}

// listMonitors enumerates the monitors. The preview (a screenshot of each screen) is slow, so it is
// only taken when the config screen asks for it, never at startup.
func (ws *WindowService) listMonitors(withPreview bool) []Monitor {

	var monitors []Monitor
	//var primaryMonitor Monitor

	// Callback function to populate the monitors slice
	monitorEnumProc := func(hMonitor windows.Handle, hdcMonitor windows.Handle, lprcMonitor *windows.Rect, dwData uintptr) uintptr {
		var mi MonitorInfoEx
		mi.CbSize = uint32(unsafe.Sizeof(mi))

		// Call GetMonitorInfo via Windows API
		r1, _, _ := procGetMonitorInfo.Call(uintptr(hMonitor), uintptr(unsafe.Pointer(&mi)))
		if r1 != 0 {

			// Calculate width and height
			width := int(mi.RcMonitor.Right - mi.RcMonitor.Left)
			height := int(mi.RcMonitor.Bottom - mi.RcMonitor.Top)
			x := int(mi.RcMonitor.Left)
			y := int(mi.RcMonitor.Top)

			// Get the device name (the number is set after sorting, below)
			deviceName := fmt.Sprintf("%dx%d", width, height)
			if mi.DwFlags&1 != 0 { // MONITORINFOF_PRIMARY
				deviceName += " (principal)"
			}

			// Get a preview of the monitor
			preview := ""
			if withPreview {
				var err error
				preview, err = ws.captureMonitorPreview(x, y, width, height)
				if err != nil {
					fmt.Println("Preview error:", err)
				}
			}

			// Create a Monitor struct
			monitor := Monitor{
				Name:    deviceName,
				Width:   width,
				Height:  height,
				X:       x,
				Y:       y,
				Preview: preview,
			}

			monitors = append(monitors, monitor)
		}
		return 1 // Continue enumeration
	}

	// Call EnumDisplayMonitors with the callback
	r1, _, _ := procEnumDisplayMonitors.Call(0, 0, syscall.NewCallback(monitorEnumProc), 0)
	if r1 == 0 {
		fmt.Println("Failed to enumerate displays")
	}

	// Sort monitors by position (Left)
	sort.Slice(monitors, func(i, j int) bool {
		return monitors[i].X < monitors[j].X
	})

	// The number shown to the user is the position in this sorted list (the same one the config uses)
	for i := range monitors {
		monitors[i].Name = fmt.Sprintf("[%d] %s", i+1, monitors[i].Name)
	}

	return monitors

}

// captureMonitorPreview captures a preview image of the monitor using GDI.
func (ws *WindowService) captureMonitorPreview(x, y, width, height int) (string, error) {
	win := ws.winapi
	if width <= 0 || height <= 0 {
		return "", fmt.Errorf("invalid monitor size")
	}

	// Get screen device context
	hdcScreen, _, _ := win.getDC.Call(0)
	hdcMem, _, _ := win.createCompatibleDC.Call(hdcScreen)
	hbm, _, _ := win.createCompatibleBitmap.Call(hdcScreen, uintptr(width), uintptr(height))
	win.selectObject.Call(hdcMem, hbm)

	// Copy screen into bitmap
	const SRCCOPY = 0x00CC0020
	win.bitBlt.Call(hdcMem, 0, 0, uintptr(width), uintptr(height), hdcScreen, uintptr(x), uintptr(y), SRCCOPY)

	// Create BITMAPINFO
	type BITMAPINFOHEADER struct {
		Size          uint32
		Width         int32
		Height        int32
		Planes        uint16
		BitCount      uint16
		Compression   uint32
		SizeImage     uint32
		XPelsPerMeter int32
		YPelsPerMeter int32
		ClrUsed       uint32
		ClrImportant  uint32
	}

	type BITMAPINFO struct {
		Header BITMAPINFOHEADER
		Colors [1]uint32
	}

	bi := BITMAPINFO{
		Header: BITMAPINFOHEADER{
			Size:        uint32(unsafe.Sizeof(BITMAPINFOHEADER{})),
			Width:       int32(width),
			Height:      -int32(height), // top-down DIB
			Planes:      1,
			BitCount:    32,
			Compression: 0, // BI_RGB
		},
	}

	// Create image buffer
	bufLen := width * height * 4
	buf := make([]byte, bufLen)

	ret, _, _ := win.getDIBits.Call(hdcMem, hbm, 0, uintptr(height),
		uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&bi)), 0)

	if ret == 0 {
		win.deleteObject.Call(hbm)
		win.deleteDC.Call(hdcMem)
		win.releaseDC.Call(0, hdcScreen)
		return "", fmt.Errorf("GetDIBits failed")
	}

	// Convert raw BGRA bytes to RGBA. The screen copy has no alpha, so it is forced to opaque
	// (otherwise the preview comes out black). Direct copy: far faster than setting pixel by pixel.
	rgba := image.NewRGBA(image.Rect(0, 0, width, height))
	for i := 0; i+3 < len(buf) && i+3 < len(rgba.Pix); i += 4 {
		rgba.Pix[i] = buf[i+2]
		rgba.Pix[i+1] = buf[i+1]
		rgba.Pix[i+2] = buf[i]
		rgba.Pix[i+3] = 255
	}

	// Cleanup GDI
	win.deleteObject.Call(hbm)
	win.deleteDC.Call(hdcMem)
	win.releaseDC.Call(0, hdcScreen)

	// Encode PNG to base64 in a goroutine
	previewCh := make(chan string, 1)
	go func() {
		var pngBuf bytes.Buffer
		if err := jpeg.Encode(&pngBuf, rgba, &jpeg.Options{Quality: 80}); err != nil {
			fmt.Println("PNG encode failed:", err)
			previewCh <- ""
			return
		}
		dataURI := "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(pngBuf.Bytes())
		previewCh <- dataURI
	}()

	preview := <-previewCh
	return preview, nil
}

// Blur the overlay window
func (ws *WindowService) Blur() {
	if ws.windowMode {
		return
	}
	WailsWindow.SetIgnoreMouseEvents(true)
}

// Focus the overlay window
func (ws *WindowService) Focus() {
	if ws.windowMode {
		return
	}
	WailsWindow.SetIgnoreMouseEvents(false)
	WailsWindow.Focus()
}

func (ws *WindowService) GetResolution() (int, int) {
	monitors := ws.listMonitors(false)
	if len(monitors) == 0 {
		return 1920, 1080
	}
	return monitors[0].Width, monitors[0].Height
}

// Reset has default value of false
func (ws *WindowService) MoveMainWindowToMonitor(index int) {

	// Get the list of monitors (no previews: this runs at every startup)
	monitors := ws.listMonitors(false)
	if len(monitors) == 0 {
		fmt.Println("No monitors found")
		return
	}
	// A saved monitor that is no longer connected falls back to the first one
	if index < 0 || index >= len(monitors) {
		fmt.Println("Invalid monitor index, using the first one")
		index = 0
	}

	monitor := monitors[index]

	if ws.reset && !ws.windowMode {
		WailsWindow.ToggleFullscreen()
	}

	// Move the window to the monitor
	//win.SetWindowPos(hwnd, 0, int32(monitor.X), int32(0), int32(monitor.Width), int32(monitor.Height), win.SWP_NOSIZE|win.SWP_NOZORDER)
	WailsWindow.SetPosition(monitor.X, monitor.Y)
	WailsWindow.SetSize(monitor.Width, monitor.Height)

	fmt.Printf("Moved window to monitor %d: %s (%d x %d) (x: %d, y: %d)\n", index, monitor.Name, monitor.Width, monitor.Height, monitor.X, monitor.Y)

	if !ws.windowMode {
		WailsWindow.Fullscreen().Maximise()
		WailsWindow.SetAlwaysOnTop(true)
	}

	// Reset on next call
	ws.reset = true

}

// CreateStudioWindow creates a new window for the overlay customization
func (ws *WindowService) CreateStudioWindow() {
	// Do nothing if the overlay window already exists
	if StudioWindow != nil {
		return
	}

	// Create a new studio window
	StudioWindow = WailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:                      "Phoenix Overlay Studio",
		URL:                        "/?mode=studio",
		Zoom:                       1,
		Width:                      1280,
		Height:                     720,
		ZoomControlEnabled:         true,
		DefaultContextMenuDisabled: true,
	})

	StudioWindow.Maximise()

	// Cleanup
	StudioWindow.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {

	})

}

// CreateStudioWindow creates the headless overlay window
func (ws *WindowService) CreateHeadlessWindow() {
	// Do nothing if the overlay window already exists
	if HeadlessWindow != nil {
		return
	}

	// Create a new overlay window
	HeadlessWindow = WailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:                      "Phoenix Overlay Headless",
		BackgroundType:             application.BackgroundTypeTransparent,
		BackgroundColour:           application.NewRGBA(0, 0, 0, 0),
		URL:                        "/?mode=headless",
		Zoom:                       1,
		Width:                      640,
		Height:                     480,
		ZoomControlEnabled:         true,
		DefaultContextMenuDisabled: true,
		AlwaysOnTop:                true,
		IgnoreMouseEvents:          true,
		Frameless:                  true,
		DisableResize:              true,
		Hidden:                     true,
	})

}

// Just a backend way to log messages
func (ws *WindowService) Log(message string) {
	fmt.Println(message)
}
