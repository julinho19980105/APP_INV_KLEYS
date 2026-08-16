
"use client"

import * as React from "react"
import { Truck } from "lucide-react"

export default function ShippingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
        <Truck className="w-10 h-10 text-primary" />
      </div>
      <h1 className="text-3xl font-headline font-bold">Envíos y Logística</h1>
      <p className="text-muted-foreground max-w-md">
        Próximamente: Rastreo en tiempo real, integración con agencias de envío y gestión de guías.
      </p>
    </div>
  )
}
