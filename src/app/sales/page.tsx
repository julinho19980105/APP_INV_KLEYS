
"use client"

import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShoppingBag, Calculator, CreditCard, ChevronRight } from "lucide-react"
import SalesHistory from "./components/sales-history"
import QuotesView from "./components/quotes-view"
import PaymentsView from "./components/payments-view"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"

export default function CommercialHubPage() {
  const db = useFirestore()
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#0296FF"

  return (
    <div className="w-full max-w-6xl mx-auto pt-2 pb-24 px-2 md:px-0">
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-primary/20 flex items-center justify-center shadow-sm">
             <ShoppingBag className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-xl font-black text-[#1e293b] uppercase tracking-tighter">Ventas</h1>
        </div>
        <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[9px] font-black text-green-700 uppercase tracking-widest">Datos Enlazados</span>
        </div>
      </div>

      <Tabs defaultValue="quotes" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-16 bg-[#f1f5f9] border border-black/5 rounded-2xl mb-6 p-1.5 shadow-inner">
          <TabsTrigger 
            value="quotes" 
            className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md font-black text-[10px] uppercase transition-all flex items-center gap-2"
          >
            <Calculator className="w-4 h-4" /> Crear Ventas
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md font-black text-[10px] uppercase transition-all flex items-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" /> Facturas
          </TabsTrigger>
          <TabsTrigger 
            value="payments" 
            className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md font-black text-[10px] uppercase transition-all flex items-center gap-2"
          >
            <CreditCard className="w-4 h-4" /> Pagos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotes" className="mt-0 focus-visible:outline-none">
          <QuotesView />
        </TabsContent>
        <TabsContent value="history" className="mt-0 focus-visible:outline-none">
          <SalesHistory />
        </TabsContent>
        <TabsContent value="payments" className="mt-0 focus-visible:outline-none">
          <PaymentsView />
        </TabsContent>
      </Tabs>
    </div>
  )
}
