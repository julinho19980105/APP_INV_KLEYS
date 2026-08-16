
"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Trash2, Plus, UserPlus, Search, ShoppingCart, Share2, Save, Printer } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { semanticSuggestCustomersProducts } from "@/ai/flows/semantic-suggest-customers-products"
import Image from "next/image"

interface QuoteItem {
  id: string
  productId: string
  name: string
  quantity: number
  price: number
  priceType: 'fardo' | 'mayor' | 'unidad'
  stock: number
  img: string
}

export default function QuotesPage() {
  const { toast } = useToast()
  const [date, setDate] = React.useState("")
  const [time, setTime] = React.useState("")
  const [quoteId, setQuoteId] = React.useState("")
  
  const [customerQuery, setCustomerQuery] = React.useState("")
  const [customerSuggestions, setCustomerSuggestions] = React.useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = React.useState<any>(null)

  const [productQuery, setProductQuery] = React.useState("")
  const [productSuggestions, setProductSuggestions] = React.useState<any[]>([])

  const [items, setItems] = React.useState<QuoteItem[]>([])
  const [discount, setDiscount] = React.useState(0)

  React.useEffect(() => {
    setDate(new Date().toISOString().split('T')[0])
    setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    setQuoteId(`B-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`)
  }, [])

  React.useEffect(() => {
    const fetchSuggestions = async () => {
      if (customerQuery.length < 2) {
        setCustomerSuggestions([])
        return
      }
      const res = await semanticSuggestCustomersProducts({
        query: customerQuery,
        type: "customer",
        customers: [
          { id: "CL-001", name: "Ana Maria Garcia" },
          { id: "CL-002", name: "Carlos Roberto" },
          { id: "CL-003", name: "Beatriz Mendoza" },
        ]
      })
      setCustomerSuggestions(res.suggestions)
    }
    const timeout = setTimeout(fetchSuggestions, 300)
    return () => clearTimeout(timeout)
  }, [customerQuery])

  React.useEffect(() => {
    const fetchSuggestions = async () => {
      if (productQuery.length < 2) {
        setProductSuggestions([])
        return
      }
      const res = await semanticSuggestCustomersProducts({
        query: productQuery,
        type: "product",
        products: [
          { id: "P1", name: "Saco Velvet", stock: 24, imageUrl: "https://picsum.photos/seed/p1/200/200" },
          { id: "P2", name: "Pantalón Slim", stock: 48, imageUrl: "https://picsum.photos/seed/p2/200/200" },
        ]
      })
      setProductSuggestions(res.suggestions)
    }
    const timeout = setTimeout(fetchSuggestions, 300)
    return () => clearTimeout(timeout)
  }, [productQuery])

  const addItem = (prod: any) => {
    if (items.find(i => i.productId === prod.id)) return
    setItems([...items, {
      id: Math.random().toString(),
      productId: prod.id,
      name: prod.name,
      quantity: 1,
      price: 85,
      priceType: 'mayor',
      stock: prod.stock,
      img: prod.imageUrl || ""
    }])
    setProductQuery("")
    setProductSuggestions([])
  }

  const updateItem = (id: string, updates: Partial<QuoteItem>) => {
    setItems(items.map(i => i.id === id ? { ...i, ...updates } : i))
  }

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id))
  }

  const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.price), 0)
  const total = subtotal - discount
  const totalQty = items.reduce((acc, item) => acc + item.quantity, 0)

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-headline font-bold">Nueva Cotización</h1>
          <p className="text-muted-foreground">Genera una proforma dinámica para el cliente.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            if (confirm("¿Limpiar cotización?")) {
              setItems([])
              setSelectedCustomer(null)
              setDiscount(0)
            }
          }}>Limpiar</Button>
          <Button variant="outline" size="icon"><Printer className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="grid grid-cols-2 gap-4 pb-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground tracking-widest">Código Boleta</Label>
                <div className="text-xl font-headline font-bold text-primary">{quoteId || "..."}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground tracking-widest">Fecha</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground tracking-widest">Hora</Label>
                  <Input value={time} readOnly className="h-8 text-xs bg-muted" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6 border-t">
              <div className="relative space-y-2">
                <Label>Cliente</Label>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-accent/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                        {selectedCustomer.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium">{selectedCustomer.name}</div>
                        <div className="text-xs text-muted-foreground">{selectedCustomer.id || "CL-XXX"}</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedCustomer(null)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Buscar cliente (Ana, Carlos...)" 
                          className="pl-9"
                          value={customerQuery}
                          onChange={e => setCustomerQuery(e.target.value)}
                        />
                      </div>
                      <Button variant="outline"><UserPlus className="w-4 h-4" /></Button>
                    </div>
                    {customerSuggestions.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-card border rounded-lg shadow-xl overflow-hidden">
                        {customerSuggestions.map(c => (
                          <button 
                            key={c.id} 
                            className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b last:border-0"
                            onClick={() => {
                              setSelectedCustomer(c)
                              setCustomerQuery("")
                              setCustomerSuggestions([])
                            }}
                          >
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{c.id}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="relative space-y-2 pt-4 border-t">
                <Label>Añadir Productos</Label>
                <div className="relative">
                  <ShoppingCart className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Nombre de prenda para autocompletar..." 
                    className="pl-9"
                    value={productQuery}
                    onChange={e => setProductQuery(e.target.value)}
                  />
                </div>
                {productSuggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-card border rounded-lg shadow-xl overflow-hidden">
                    {productSuggestions.map(p => (
                      <button 
                        key={p.id} 
                        className="w-full text-left px-4 py-3 hover:bg-accent flex items-center justify-between border-b last:border-0"
                        onClick={() => addItem(p)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative w-8 h-8 rounded overflow-hidden">
                              {p.imageUrl && <Image src={p.imageUrl} alt="" fill className="object-cover" />}
                          </div>
                          <div>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">Stock: {p.stock}</div>
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-primary" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 mt-6">
                {items.map(item => (
                  <div key={item.id} className="flex flex-col md:flex-row gap-4 p-4 rounded-xl border bg-muted/20 relative group">
                    <div className="flex gap-4 flex-1">
                      <div className="relative w-12 h-12 rounded overflow-hidden bg-muted">
                          <Image src={item.img || "https://picsum.photos/seed/item/200/200"} alt="" fill className="object-cover" data-ai-hint="fashion clothes" />
                      </div>
                      <div className="space-y-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Stock: {item.stock}</div>
                        <div className="flex items-center gap-2 pt-2">
                           <Select 
                            value={item.priceType} 
                            onValueChange={(v: any) => updateItem(item.id, { priceType: v, price: v === 'fardo' ? 70 : v === 'mayor' ? 85 : 100 })}
                          >
                             <SelectTrigger className="h-7 w-28 text-xs">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="fardo">Fardo</SelectItem>
                               <SelectItem value="mayor">Al Mayor</SelectItem>
                               <SelectItem value="unidad">Unidad</SelectItem>
                             </SelectContent>
                           </Select>
                           <Input 
                             type="number" 
                             value={item.price} 
                             onChange={e => updateItem(item.id, { price: parseFloat(e.target.value) || 0 })}
                             className="h-7 w-20 text-xs" 
                           />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="space-y-1">
                         <Label className="text-[10px]">CANT.</Label>
                         <Input 
                          type="number" 
                          max={item.stock}
                          value={item.quantity} 
                          onChange={e => updateItem(item.id, { quantity: Math.min(item.stock, parseInt(e.target.value) || 1) })}
                          className="h-8 w-16 text-center"
                        />
                      </div>
                      <div className="text-right min-w-[80px]">
                        <div className="text-[10px] text-muted-foreground">TOTAL</div>
                        <div className="font-bold">S/ {(item.price * item.quantity).toFixed(2)}</div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="py-20 text-center border-2 border-dashed rounded-xl text-muted-foreground">
                    No hay prendas en la cotización.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-primary text-primary-foreground border-none shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <ShoppingCart className="w-32 h-32" />
            </div>
            <CardHeader>
              <CardTitle className="text-primary-foreground/80 uppercase text-xs tracking-[0.2em]">Resumen de Pago</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 relative z-10">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] uppercase opacity-60">Total Unidades</div>
                  <div className="font-headline font-bold text-5xl">{totalQty}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase opacity-60">Total a Pagar</div>
                  <div className="font-headline font-bold text-5xl tracking-tighter">S/ {total.toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-2 border-t border-primary-foreground/20 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="opacity-70">Subtotal:</span>
                  <span className="font-medium">S/ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="opacity-70">Descuento (PEN):</span>
                  <Input 
                    type="number" 
                    value={discount} 
                    onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-20 h-7 text-xs bg-white/10 border-white/20 text-white text-right" 
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button className="flex-1 bg-white text-primary hover:bg-white/90 font-bold" onClick={() => toast({ title: "Guardado", description: "Cotización registrada." })}>
                <Save className="w-4 h-4 mr-2" />
                GUARDAR
              </Button>
              <Button className="flex-1 bg-black/20 text-white hover:bg-black/30 border-none" onClick={() => toast({ title: "Enviado", description: "Proforma enviada al cliente." })}>
                <Share2 className="w-4 h-4 mr-2" />
                ENVIAR
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Notas Adicionales</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea placeholder="Ej: Entrega urgente, tallas específicas..." className="text-sm bg-muted/30" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
