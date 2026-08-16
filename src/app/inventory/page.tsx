
"use client"

import * as React from "react"
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
import { Search, Filter, Eye, Edit2, History, ArrowDownRight, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { getSheetData } from "@/services/sheets-service"

export default function InventoryPage() {
  const [products, setProducts] = React.useState<any[]>([])
  const [movements, setMovements] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [query, setQuery] = React.useState("")

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const pData = await getSheetData('PRODUCTOS')
        const mData = await getSheetData('MOVIMIENTOS')
        setProducts(Array.isArray(pData) ? pData : [])
        setMovements(Array.isArray(mData) ? mData : [])
      } catch (error) {
        console.error("Error cargando inventario:", error)
        setProducts([])
        setMovements([])
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const filteredProducts = Array.isArray(products) ? products.filter(p => 
    p.Nombre?.toLowerCase().includes(query.toLowerCase()) || 
    p.Codigo?.toLowerCase().includes(query.toLowerCase())
  ) : []

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Inventario Diva</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Gestión de Stock y Movimientos</p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-accent" />
            <Input 
              placeholder="Buscar prenda..." 
              className="pl-9 rounded-xl border-accent/20"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" className="rounded-xl border-accent text-accent">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-2xl mb-6">
          <TabsTrigger value="all" className="rounded-xl px-6">Stock Actual</TabsTrigger>
          <TabsTrigger value="movements" className="rounded-xl px-6">Movimientos (Kardex)</TabsTrigger>
          <TabsTrigger value="out" className="rounded-xl px-6">Sin Stock</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="border rounded-[2rem] overflow-hidden bg-card shadow-xl border-none min-h-[400px]">
          {loading ? (
            <div className="p-20 text-center text-accent font-bold animate-pulse">CARGANDO DATOS...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-accent/5 hover:bg-accent/5">
                  <TableHead className="w-[80px] font-black uppercase text-[10px] text-accent">Foto</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-accent">Código</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-accent">Nombre</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-accent">Categoría</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] text-accent">Precio Mayor</TableHead>
                  <TableHead className="text-center font-black uppercase text-[10px] text-accent">Stock</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] text-accent">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length > 0 ? filteredProducts.map((p, idx) => (
                  <TableRow key={p.Codigo || idx} className="group transition-colors hover:bg-primary/5">
                    <TableCell>
                      <div className="w-12 h-12 rounded-2xl border border-accent/10 overflow-hidden bg-muted relative shadow-sm">
                        <Image 
                          src={p.LinkImagen || "https://picsum.photos/seed/placeholder/200/200"} 
                          alt={p.Nombre || ""} 
                          fill
                          className="object-cover"
                          data-ai-hint="fashion item"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-accent">{p.Codigo}</TableCell>
                    <TableCell className="font-bold text-primary">{p.Nombre}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-black text-[9px] uppercase tracking-widest bg-accent/10 text-accent border-none">
                        {p.Categoria || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-black text-primary">S/ {p.PrecioMayor || 0}</TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        "font-black text-base px-3 py-1 rounded-full",
                        Number(p.Stock) === 0 ? "bg-destructive/10 text-destructive" : Number(p.Stock) < 10 ? "bg-orange-100 text-orange-500" : "bg-green-100 text-green-600"
                      )}>
                        {p.Stock || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-accent hover:bg-accent/10 rounded-xl"><Eye className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10 rounded-xl"><Edit2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-20 text-muted-foreground font-medium">
                      No se encontraron prendas en el inventario.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TabsContent>
        
        <TabsContent value="movements" className="space-y-4">
          <div className="border rounded-[2rem] overflow-hidden bg-card shadow-xl border-none">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/5 hover:bg-primary/5">
                  <TableHead className="font-black uppercase text-[10px] text-primary">Fecha</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-primary">Prenda</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-primary">Tipo</TableHead>
                  <TableHead className="text-center font-black uppercase text-[10px] text-primary">Cantidad</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-primary">Motivo / Referencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.length > 0 ? movements.map((m, idx) => (
                  <TableRow key={m.ID || idx}>
                    <TableCell className="text-xs font-medium text-muted-foreground">
                      {m.Fecha ? new Date(m.Fecha).toLocaleDateString() : ""}
                    </TableCell>
                    <TableCell className="font-bold text-accent font-mono">{m.CodigoPrenda}</TableCell>
                    <TableCell>
                      {m.Tipo === 'in' ? (
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
                      {m.Tipo === 'in' ? '+' : '-'}{m.Cantidad}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{m.Motivo}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-medium">
                      No hay registros de movimientos.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
