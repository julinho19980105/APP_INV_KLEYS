
"use client"

import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShoppingBag, Calculator, CreditCard, Plus } from "lucide-react"
import SalesHistory from "./components/sales-history"
import QuotesView from "./components/quotes-view"
import PaymentsView from "./components/payments-view"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"

export default function CommercialHubPage() {
  const db = useFirestore()
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)

  return (
    <div className="w-full max-w-6xl mx-auto pt-0 pb-24">
      <Tabs defaultValue="quotes" className="w-full">
        <TabsList className="chrome-tab-list sticky top-[57px] z-[45]">
          <TabsTrigger 
            value="quotes" 
            className="chrome-tab-trigger"
          >
            <Plus className="w-3 h-3 mr-2 opacity-50" /> CREAR VENTAS
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="chrome-tab-trigger"
          >
            <ShoppingBag className="w-3 h-3 mr-2 opacity-50" /> FACTURAS
          </TabsTrigger>
          <TabsTrigger 
            value="payments" 
            className="chrome-tab-trigger"
          >
            <CreditCard className="w-3 h-3 mr-2 opacity-50" /> PAGOS
          </TabsTrigger>
        </TabsList>

        <div className="px-1 md:px-0 mt-0">
          <TabsContent value="quotes" className="mt-0 focus-visible:outline-none">
            <QuotesView />
          </TabsContent>
          <TabsContent value="history" className="mt-0 focus-visible:outline-none">
            <SalesHistory />
          </TabsContent>
          <TabsContent value="payments" className="mt-0 focus-visible:outline-none">
            <PaymentsView />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
