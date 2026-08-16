
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = errorEmitter.on('permission-error', (error) => {
      toast({
        variant: "destructive",
        title: "Error de Permisos",
        description: `No tienes permiso para ${error.context.operation} en ${error.context.path}`,
      });
    });

    return () => unsubscribe();
  }, [toast]);

  return null;
}
