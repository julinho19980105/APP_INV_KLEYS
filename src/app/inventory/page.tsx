
"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Package, PackagePlus, History } from "lucide-react"
import InventoryList from "./components/inventory-list"
import RegistryView from "../registry/page"
import MovementsView from "../movements/page"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"

export default function InventoryHubPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') || 'list'
  
  const db = useFirestore()
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#0296FF"

  const onTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    if (value !== 'registry') params.delete('edit')
    router.push(`/inventory?${params.toString()}`)
  }

  return (
    <div className="w-full max-w-6xl mx-auto pt-2 pb-24">
      <Tabs value={tabParam} onValueChange={onTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-16 bg-white border-b border-primary/10 rounded-none mb-6 sticky top-0 z-50 shadow-sm p-1">
          <TabsTrigger 
            value="list" 
            className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white font-black text-xs uppercase transition-all flex items-center gap-2"
          >
            <Package className="w-4 h-4" /> Productos
          </TabsTrigger>
          <TabsTrigger 
            value="registry" 
            className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white font-black text-xs uppercase transition-all flex items-center gap-2"
          >
            <PackagePlus className="w-4 h-4" /> Registro
          </TabsTrigger>
          <TabsTrigger 
            value="movements" 
            className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white font-black text-xs uppercase transition-all flex items-center gap-2"
          >
            <History className="w-4 h-4" /> Movimientos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-0 focus-visible:outline-none">
          <InventoryList />
        </TabsContent>
        <TabsContent value="registry" className="mt-0 focus-visible:outline-none">
          <RegistryView />
        </TabsContent>
        <TabsContent value="movements" className="mt-0 focus-visible:outline-none">
          <MovementsView />
        </TabsContent>
      </Tabs>
    </div>
  )
}
