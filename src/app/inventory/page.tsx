
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

  const onTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    if (value !== 'registry') params.delete('edit')
    router.push(`/inventory?${params.toString()}`)
  }

  return (
    <div className="w-full max-w-6xl mx-auto pt-0 pb-24">
      <Tabs value={tabParam} onValueChange={onTabChange} className="w-full">
        <TabsList className="chrome-tab-list sticky top-[57px] z-[45]">
          <TabsTrigger 
            value="list" 
            className="chrome-tab-trigger"
          >
            <Package className="w-3 h-3 mr-2 opacity-50" /> Productos
          </TabsTrigger>
          <TabsTrigger 
            value="registry" 
            className="chrome-tab-trigger"
          >
            <PackagePlus className="w-3 h-3 mr-2 opacity-50" /> Registro
          </TabsTrigger>
          <TabsTrigger 
            value="movements" 
            className="chrome-tab-trigger"
          >
            <History className="w-3 h-3 mr-2 opacity-50" /> Movimientos
          </TabsTrigger>
        </TabsList>

        <div className="px-1 md:px-0 mt-0">
          <TabsContent value="list" className="mt-0 focus-visible:outline-none">
            <InventoryList />
          </TabsContent>
          <TabsContent value="registry" className="mt-0 focus-visible:outline-none">
            <RegistryView />
          </TabsContent>
          <TabsContent value="movements" className="mt-0 focus-visible:outline-none">
            <MovementsView />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
