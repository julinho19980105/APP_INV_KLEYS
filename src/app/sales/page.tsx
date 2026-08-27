
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
  const brandColor = config?.brandColor || "#FF3399"

  return (
    <div className="w-full max-w-6xl mx-auto pt-2 pb-24">
      <Tabs defaultValue="quotes" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-16 bg-white border-b border-primary/10 rounded-none mb-4 sticky top-0 z-50 shadow-sm p-1">
          <TabsTrigger 
            value="quotes" 
            className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white font-black text-xs uppercase transition-all flex items-center gap-2"
          >
            <Calculator className="w-4 h-4" /> Cotización
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white font-black text-xs uppercase transition-all flex items-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" /> Ventas
          </TabsTrigger>
          <TabsTrigger 
            value="payments" 
            className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white font-black text-xs uppercase transition-all flex items-center gap-2"
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
