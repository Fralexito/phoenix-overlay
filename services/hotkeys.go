package services

import (
	"fmt"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
	"golang.design/x/hotkey"
)

type HotkeyService struct {
	hotkeys map[string]*hotkey.Hotkey
	events  map[string]string
	defs    map[string]ChangeHotkeyArgs // last keys that worked, to put them back if a change fails
	mu      sync.Mutex
}

// ---- Argument structs (Wails-safe) ----

type RegisterHotkeyArgs struct {
	Name      string
	Modifiers []int
	Key       int
	Event     string
}

type ChangeHotkeyArgs struct {
	Name      string
	Modifiers []int
	Key       int
}

// ---- Constructor ----

func NewHotkeyService() *HotkeyService {
	return &HotkeyService{
		hotkeys: make(map[string]*hotkey.Hotkey),
		events:  make(map[string]string),
		defs:    make(map[string]ChangeHotkeyArgs),
	}
}

// ---- Public API (exported, binding-safe) ----

func (h *HotkeyService) RegisterHotkey(args RegisterHotkeyArgs) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Registered again (for example the page was reloaded): free the old one first,
	// otherwise Windows refuses the same keys a second time.
	if old, ok := h.hotkeys[args.Name]; ok {
		old.Unregister()
		delete(h.hotkeys, args.Name)
	}

	modifiers := mapModifiers(args.Modifiers)
	key := mapKey(args.Key)

	hk := hotkey.New(modifiers, key)
	if err := hk.Register(); err != nil {
		return err
	}

	h.hotkeys[args.Name] = hk
	h.events[args.Name] = args.Event
	h.defs[args.Name] = ChangeHotkeyArgs{Name: args.Name, Modifiers: args.Modifiers, Key: args.Key}

	h.startListener(hk, args.Name, args.Event)

	return nil
}

func (h *HotkeyService) ChangeHotkey(args ChangeHotkeyArgs) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	hk, exists := h.hotkeys[args.Name]
	if !exists {
		return fmt.Errorf("hotkey with name %s does not exist", args.Name)
	}

	hk.Unregister()

	modifiers := mapModifiers(args.Modifiers)
	key := mapKey(args.Key)

	newHK := hotkey.New(modifiers, key)
	if err := newHK.Register(); err != nil {
		// The new keys are taken by another program: put the old ones back so the shortcut keeps working
		if old, ok := h.defs[args.Name]; ok {
			restored := hotkey.New(mapModifiers(old.Modifiers), mapKey(old.Key))
			if restored.Register() == nil {
				h.hotkeys[args.Name] = restored
				h.startListener(restored, args.Name, h.events[args.Name])
			}
		}
		return err
	}

	h.defs[args.Name] = args
	h.hotkeys[args.Name] = newHK
	h.startListener(newHK, args.Name, h.events[args.Name])

	return nil
}

func (h *HotkeyService) UnregisterAll() {
	h.mu.Lock()
	defer h.mu.Unlock()

	for _, hk := range h.hotkeys {
		hk.Unregister()
	}

	h.hotkeys = make(map[string]*hotkey.Hotkey)
	h.events = make(map[string]string)
	h.defs = make(map[string]ChangeHotkeyArgs)
}

// ---- Internal helpers (NOT exported) ----

func (h *HotkeyService) startListener(hk *hotkey.Hotkey, name, event string) {
	go func(hk *hotkey.Hotkey, name, event string) {
		for range hk.Keydown() {
			if WailsApp == nil {
				continue
			}

			WailsApp.Event.EmitEvent(&application.CustomEvent{
				Name: event,
				Data: map[string]interface{}{
					"name": name,
				},
			})
		}
	}(hk, name, event)
}

func mapKey(keyCode int) hotkey.Key {
	return hotkey.Key(keyCode)
}

func mapModifiers(modifierCodes []int) []hotkey.Modifier {
	modifiers := make([]hotkey.Modifier, 0, len(modifierCodes))

	for _, code := range modifierCodes {
		switch code {
		case 16:
			modifiers = append(modifiers, hotkey.ModShift)
		case 17:
			modifiers = append(modifiers, hotkey.ModCtrl)
		case 18:
			modifiers = append(modifiers, hotkey.ModAlt)
		case 91, 92:
			modifiers = append(modifiers, hotkey.ModWin)
		}
	}

	return modifiers
}
