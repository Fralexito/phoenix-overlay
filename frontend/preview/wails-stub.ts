// Solo para la vista previa en navegador: imita lo mínimo de @wailsio/runtime.
export const Events = { On: (_n: string, _f: any) => {}, Emit: () => {} };
export const Application = { Quit: () => {} };
export const Create = {
  Array: (f: any) => (a: any) => (a || []).map(f), Any: (x: any) => x, Map: (_k: any, v: any) => (m: any) => m, Nullable: (f: any) => (x: any) => x, ByteSlice: (x: any) => x,
};
const vacio = (id: number): Promise<any> => {
  // GetOverlayStyles / LoadPlugins devuelven listas; GetProp devuelve [valor]
  return Promise.resolve([]);
};
export const Call = { ByID: (id: number, ..._a: any[]) => vacio(id), ByName: (..._a: any[]) => vacio(0) };
export class CancellablePromise<T> extends Promise<T> {}
