
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Filter, Edit2, ArrowDownRight, ArrowUpRight, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { useCollection, useFirestore } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"

export default function InventoryPage() {
  const router = useRouter()
  const db = useFirestore()
  const [searchQuery, setSearchQuery] = React.useState("")

  const productsRef = React.useMemo(() => db ? query(collection(db, "products"), orderBy("updatedAt", "desc")) : null, [db])
  const movementsRef = React.useMemo(() => db ? query(collection(db, "movements"), orderBy("timestamp", "desc")) : null, [db])

  const { data: products = [], loading: loadingProducts } = useCollection(productsRef)
  const { data: movements = [], loading: loadingMovements } = useCollection(movementsRef)

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.code?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Inventario Diva</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Cloud Sync Realtime • Firebase</p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-accent" />
            <Input 
              placeholder="Buscar por código o nombre..." 
              className="pl-9 rounded-xl border-accent/20 bg-white"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Button className="rounded-xl bg-primary shadow-lg" onClick={() => router.push('/registry')}>
            <Plus className="w-4 h-4 mr-2" /> Nueva Prenda
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-2xl mb-6">
          <TabsTrigger value="all" className="rounded-xl px-6">Stock Actual</TabsTrigger>
          <TabsTrigger value="movements" className="rounded-xl px-6">Kardex</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="border rounded-[2rem] overflow-hidden bg-card shadow-xl border-none min-h-[400px]">
          {loadingProducts ? (
            <div className="p-20 text-center text-accent font-bold animate-pulse uppercase tracking-widest">Sincronizando con Firestore...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-accent/5 hover:bg-accent/5">
                  <TableHead className="w-[80px] font-black uppercase text-[10px] text-accent">Foto</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-accent">Cód / Nombre</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-accent">Categoría</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] text-accent">Fardo / Mayor / Unid</TableHead>
                  <TableHead className="text-center font-black uppercase text-[10px] text-accent">Stock</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] text-accent">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length > 0 ? filteredProducts.map((p) => (
                  <TableRow key={p.id} className="group transition-colors hover:bg-primary/5">
                    <TableCell>
                      <div className="w-12 h-12 rounded-2xl border border-accent/10 overflow-hidden bg-muted relative shadow-sm">
                        <Image 
                          src={(p.images && p.images[0]) || "https://picsum.photos/seed/placeholder/200/200"} 
                          alt={p.name || ""} 
                          fill
                          className="object-cover"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs font-bold text-accent">{p.code}</div>
                      <div className="font-bold text-primary">{p.name}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-black text-[9px] uppercase tracking-widest bg-accent/10 text-accent border-none">
                        {p.category || 'Sin Cat.'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-[10px] text-muted-foreground">S/ {p.priceFardo} - {p.priceMayor} - <span className="text-primary font-bold">{p.priceUnidad}</span></div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        "font-black text-base px-3 py-1 rounded-full",
                        p.stock === 0 ? "bg-destructive/10 text-destructive" : p.stock < 10 ? "bg-orange-100 text-orange-500" : "bg-green-100 text-green-600"
                      )}>
                        {p.stock}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 text-primary hover:bg-primary/10 rounded-xl"
                        onClick={() => router.push(`/registry?edit=${p.id}`)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-muted-foreground font-medium">
                      No hay productos registrados en la nube.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="movements">
           <div className="border rounded-[2rem] overflow-hidden bg-card shadow-xl border-none">
            {loadingMovements ? (
              <div className="p-20 text-center text-primary font-bold animate-pulse uppercase tracking-widest">Cargando Historial...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/5 hover:bg-primary/5">
                    <TableHead className="font-black uppercase text-[10px] text-primary">Fecha</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-primary">Prenda</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-primary">Tipo</TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px] text-primary">Cantidad</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-primary">Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleString() : ""}
                      </TableCell>
                      <TableCell className="font-bold text-accent font-mono">{m.productCode}</TableCell>
                      <TableCell>
                        {m.type === 'in' ? (
                          <div className="flex items-center gap-1 text-green-600 font-bold text-xs">
                            <ArrowUpRight className="w-3 h-3" /> INGRESO
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-destructive font-bold text-xs">
                            <ArrowDownRight className="w-3 h-3" /> SALIDA
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-black text-lg">
                        {m.type === 'in' ? '+' : '-'}{m.quantity}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{m.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
