
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
        <TabsList className="grid w-full grid-cols-3 h-14 bg-[#f1f5f9] border border-black/5 rounded-2xl mb-4 p-1 shadow-inner">
          <TabsTrigger 
            value="quotes" 
            className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md font-black text-[9px] uppercase transition-all flex items-center gap-1.5"
          >
            <Calculator className="w-4 h-4" /> Crear Ventas
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md font-black text-[9px] uppercase transition-all flex items-center gap-1.5"
          >
            <ShoppingBag className="w-4 h-4" /> Facturas
          </TabsTrigger>
          <TabsTrigger 
            value="payments" 
            className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md font-black text-[9px] uppercase transition-all flex items-center gap-1.5"
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
