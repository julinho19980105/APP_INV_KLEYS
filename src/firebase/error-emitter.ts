
'use client';

type ErrorListener = (error: any) => void;

class ErrorEmitter {
  private listeners: { [key: string]: ErrorListener[] } = {};

  on(channel: string, listener: ErrorListener) {
    if (!this.listeners[channel]) this.listeners[channel] = [];
    this.listeners[channel].push(listener);
    return () => {
      this.listeners[channel] = this.listeners[channel].filter(l => l !== listener);
    };
  }

  emit(channel: string, error: any) {
    if (this.listeners[channel]) {
      this.listeners[channel].forEach(listener => listener(error));
    }
  }
}

export const errorEmitter = new ErrorEmitter();
