
"use client"

import * as React from "react"
import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center">
        <Settings className="w-10 h-10 text-muted-foreground" />
      </div>
      <h1 className="text-3xl font-headline font-bold">Configuración</h1>
      <p className="text-muted-foreground max-w-md">
        Gestiona los datos de tu empresa, usuarios y preferencias del sistema.
      </p>
    </div>
  )
}
