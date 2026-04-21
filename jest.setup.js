// Suprimir console.error durante los tests para una salida más limpia
global.console = {
  ...console,
  error: jest.fn()
};
