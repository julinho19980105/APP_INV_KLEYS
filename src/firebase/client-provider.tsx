
'use client';

import React, { useEffect, useState } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { Loader2 } from 'lucide-react';

export const FirebaseClientProvider = ({ children }: { children: React.ReactNode }) => {
  const [services, setServices] = useState<any>(null);

  useEffect(() => {
    const initialized = initializeFirebase();
    if (initialized.app) {
      setServices(initialized);
    }
  }, []);

  if (!services) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Iniciando Sistema...</span>
        </div>
      </div>
    );
  }

  return (
    <FirebaseProvider 
      app={services.app} 
      db={services.db} 
      auth={services.auth} 
      storage={services.storage}
    >
      <FirebaseErrorListener />
      {children}
    </FirebaseProvider>
  );
};
