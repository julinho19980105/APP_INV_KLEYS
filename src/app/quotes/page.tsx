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
import { Trash2, Plus, UserPlus, Search, ShoppingCart, Share2, Save, Printer, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { semanticSuggestCustomersProducts } from "@/ai/flows/semantic-suggest-customers-products"
import Image from "next/image"

interface QuoteItem {
  id: string
  productId: string
  name: string
  quantity: number | string
  price: number | string
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
  const [discount, setDiscount] = React.useState<string | number>("")

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

  const subtotal = items.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.price || 0)), 0)
  const total = subtotal - Number(discount || 0)
  const totalQty = items.reduce((acc, item) => acc + Number(item.quantity || 0), 0)

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-headline font-bold text-primary flex items-center gap-3">
            Nueva Cotización
            <Sparkles className="w-6 h-6 text-accent" />
          </h1>
          <p className="text-muted-foreground font-medium">Genera una proforma dinámica para el cliente.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl border-accent text-accent" onClick={() => {
            if (confirm("¿Limpiar cotización?")) {
              setItems([])
              setSelectedCustomer(null)
              setDiscount("")
            }
          }}>Limpiar</Button>
          <Button variant="outline" className="rounded-xl border-accent text-accent" size="icon"><Printer className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="grid grid-cols-2 gap-4 pb-6 bg-accent/5 border-b border-accent/10">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-accent font-black tracking-[0.2em]">Código Boleta</Label>
                <div className="text-2xl font-headline font-bold text-primary">{quoteId || "..."}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-accent font-black tracking-[0.2em]">Fecha</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-xs rounded-xl border-accent/20" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-accent font-black tracking-[0.2em]">Hora</Label>
                  <Input value={time} readOnly className="h-9 text-xs bg-accent/5 rounded-xl border-accent/20" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8 pt-8">
              <div className="relative space-y-2">
                <Label className="text-[10px] uppercase font-black text-accent tracking-widest ml-1">Cliente Solicitante</Label>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white font-bold shadow-lg">
                        {selectedCustomer.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-lg text-primary">{selectedCustomer.name}</div>
                        <div className="text-xs text-accent font-mono">{selectedCustomer.id || "CL-XXX"}</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-destructive/10 text-destructive" onClick={() => setSelectedCustomer(null)}>
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-4 top-3.5 h-4 w-4 text-accent" />
                        <Input 
                          placeholder="Buscar cliente (Ana, Carlos...)" 
                          className="pl-11 h-11 rounded-xl border-accent/20 focus:ring-accent"
                          value={customerQuery}
                          onChange={e => setCustomerQuery(e.target.value)}
                        />
                      </div>
                      <Button variant="outline" className="h-11 w-11 rounded-xl border-accent text-accent"><UserPlus className="w-5 h-5" /></Button>
                    </div>
                    {customerSuggestions.length > 0 && (
                      <div className="absolute z-20 w-full mt-2 bg-white border border-accent/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                        {customerSuggestions.map(c => (
                          <button 
                            key={c.id} 
                            className="w-full text-left px-6 py-4 hover:bg-accent/5 transition-colors border-b last:border-0 group"
                            onClick={() => {
                              setSelectedCustomer(c)
                              setCustomerQuery("")
                              setCustomerSuggestions([])
                            }}
                          >
                            <div className="font-bold group-hover:text-primary">{c.name}</div>
                            <div className="text-[10px] text-accent font-mono uppercase tracking-widest">{c.id}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="relative space-y-2 pt-4">
                <Label className="text-[10px] uppercase font-black text-accent tracking-widest ml-1">Prendas a Cotizar</Label>
                <div className="relative">
                  <ShoppingCart className="absolute left-4 top-3.5 h-4 w-4 text-accent" />
                  <Input 
                    placeholder="Escribe el nombre de la prenda..." 
                    className="pl-11 h-11 rounded-xl border-accent/20 focus:ring-accent"
                    value={productQuery}
                    onChange={e => setProductQuery(e.target.value)}
                  />
                </div>
                {productSuggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-2 bg-white border border-accent/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                    {productSuggestions.map(p => (
                      <button 
                        key={p.id} 
                        className="w-full text-left px-6 py-4 hover:bg-accent/5 flex items-center justify-between border-b last:border-0 group"
                        onClick={() => addItem(p)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-accent/10">
                              {p.imageUrl && <Image src={p.imageUrl} alt="" fill className="object-cover" />}
                          </div>
                          <div>
                            <div className="font-bold group-hover:text-primary">{p.name}</div>
                            <div className="text-[10px] text-accent uppercase font-black tracking-tighter">Disponible: {p.stock}</div>
                          </div>
                        </div>
                        <Plus className="w-5 h-5 text-primary group-hover:scale-125 transition-transform" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {items.map(item => (
                  <div key={item.id} className="flex flex-col md:flex-row gap-6 p-6 rounded-3xl border border-primary/5 bg-gradient-to-r from-accent/5 to-white relative group transition-all hover:border-primary/20 hover:shadow-lg">
                    <div className="flex gap-6 flex-1">
                      <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-white shadow-sm border border-accent/10 shrink-0">
                          <Image src={item.img || "https://picsum.photos/seed/item/200/200"} alt="" fill className="object-cover" data-ai-hint="fashion clothes" />
                      </div>
                      <div className="space-y-3 flex-1">
                        <div>
                          <div className="font-bold text-lg text-primary">{item.name}</div>
                          <div className="text-[10px] text-accent font-black uppercase tracking-[0.2em]">Stock Almacén: {item.stock}</div>
                        </div>
                        <div className="flex items-center gap-3 pt-1">
                           <Select 
                            value={item.priceType} 
                            onValueChange={(v: any) => updateItem(item.id, { priceType: v, price: v === 'fardo' ? 70 : v === 'mayor' ? 85 : 100 })}
                          >
                             <SelectTrigger className="h-9 w-32 rounded-xl border-accent/20 bg-white">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent className="rounded-xl">
                               <SelectItem value="fardo" className="rounded-lg">Fardo</SelectItem>
                               <SelectItem value="mayor" className="rounded-lg">Al Mayor</SelectItem>
                               <SelectItem value="unidad" className="rounded-lg">Unidad</SelectItem>
                             </SelectContent>
                           </Select>
                           <div className="relative">
                            <span className="absolute left-3 top-2 text-[10px] text-accent font-bold">S/</span>
                            <Input 
                              type="number" 
                              value={item.price} 
                              onChange={e => updateItem(item.id, { price: e.target.value })}
                              className="h-9 w-24 pl-7 rounded-xl border-accent/20 bg-white font-bold"
                              placeholder="---"
                            />
                           </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-8 px-4 md:border-l border-accent/10">
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black text-accent uppercase tracking-widest text-center block">Cantidad</Label>
                         <Input 
                          type="number" 
                          max={item.stock}
                          value={item.quantity} 
                          onChange={e => updateItem(item.id, { quantity: e.target.value })}
                          className="h-11 w-20 text-center rounded-xl border-accent/20 font-bold text-lg focus:ring-accent"
                          placeholder="0"
                        />
                      </div>
                      <div className="text-right min-w-[100px]">
                        <div className="text-[10px] text-accent font-black uppercase tracking-widest mb-1">Total Item</div>
                        <div className="text-xl font-bold text-primary">S/ {(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 text-destructive rounded-full hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="py-24 text-center border-4 border-dashed rounded-[3rem] border-accent/10 text-accent/40 flex flex-col items-center gap-4">
                    <ShoppingCart className="w-16 h-16 opacity-20" />
                    <span className="font-headline font-bold text-xl tracking-tight">No hay prendas seleccionadas</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-primary via-primary to-accent text-white border-none shadow-[0_20px_50px_rgba(255,0,127,0.3)] rounded-[2.5rem] overflow-hidden relative">
            <div className="absolute -top-10 -right-10 p-8 opacity-10">
              <ShoppingCart className="w-64 h-64" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-white/60 uppercase text-[10px] font-black tracking-[0.3em]">Resumen de Proforma</CardTitle>
            </CardHeader>
            <CardContent className="space-y-10 relative z-10 pt-4">
              <div className="flex justify-between items-end border-b border-white/20 pb-8">
                <div>
                  <div className="text-[10px] uppercase font-black opacity-60 tracking-widest">Unidades</div>
                  <div className="font-headline font-bold text-5xl">{totalQty}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-black opacity-60 tracking-widest">Total Pagar</div>
                  <div className="font-headline font-bold text-6xl tracking-tighter">S/ {total.toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="opacity-70 font-medium">Subtotal Proforma:</span>
                  <span className="font-bold">S/ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="opacity-70 font-medium">Descuento Especial:</span>
                  <div className="relative">
                    <span className="absolute left-2 top-1 text-[10px] text-white/50 font-bold">S/</span>
                    <Input 
                      type="number" 
                      value={discount} 
                      onChange={e => setDiscount(e.target.value)}
                      className="w-24 h-8 pl-6 text-xs bg-white/10 border-white/20 text-white text-right font-bold rounded-lg placeholder:text-white/30" 
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-6 pb-8 px-8">
              <Button className="w-full h-14 bg-white text-primary hover:bg-white/90 font-black text-lg rounded-2xl border-none shadow-xl" onClick={() => toast({ title: "Guardado", description: "Cotización registrada con éxito." })}>
                <Save className="w-5 h-5 mr-2" />
                REGISTRAR VENTA
              </Button>
              <Button className="w-full h-12 bg-black/10 text-white hover:bg-black/20 border border-white/20 font-bold rounded-2xl" onClick={() => toast({ title: "Enviado", description: "Proforma enviada al cliente por WhatsApp." })}>
                <Share2 className="w-4 h-4 mr-2" />
                ENVIAR PROFORMA
              </Button>
            </CardFooter>
          </Card>
          
          <Card className="rounded-[2rem] border-none shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-accent/5">
              <CardTitle className="text-xs font-black uppercase text-accent tracking-[0.2em]">Observaciones</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Textarea placeholder="Ej: Entrega en agencia Flores, tallas L y XL solamente..." className="text-sm bg-accent/5 border-accent/10 rounded-2xl min-h-[100px] resize-none focus:ring-accent" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}