
"use client"

import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShoppingBag, Calculator, CreditCard } from "lucide-react"
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
    <div className="w-full max-w-6xl mx-auto pt-0 pb-24 px-1 md:px-0">
      <Tabs defaultValue="quotes" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-11 bg-slate-100/60 border border-slate-200/50 rounded-xl mb-1.5 p-1 shadow-inner">
          <TabsTrigger 
            value="quotes" 
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md font-black text-[9px] uppercase transition-all flex items-center gap-1.5 tracking-widest"
          >
            <Calculator className="w-3.5 h-3.5" /> CREAR VENTAS
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md font-black text-[9px] uppercase transition-all flex items-center gap-1.5 tracking-widest"
          >
            <ShoppingBag className="w-3.5 h-3.5" /> FACTURAS
          </TabsTrigger>
          <TabsTrigger 
            value="payments" 
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md font-black text-[9px] uppercase transition-all flex items-center gap-1.5 tracking-widest"
          >
            <CreditCard className="w-3.5 h-3.5" /> PAGOS
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
