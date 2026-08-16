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
import { Trash2, Plus, UserPlus, Search, ShoppingCart, Share2, Save, Printer, Sparkles, XCircle } from "lucide-react"
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
  const [status, setStatus] = React.useState<'active' | 'annulled'>('active')
  
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
      quantity: "",
      price: "",
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

  const handleAnnul = () => {
    if (confirm("¿Segura que deseas ANULAR esta venta? El stock se devolverá al inventario automáticamente.")) {
      setStatus('annulled')
      toast({ title: "Venta Anulada", description: "El stock ha sido devuelto al inventario." })
    }
  }

  const subtotal = items.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.price || 0)), 0)
  const total = subtotal - Number(discount || 0)
  const totalQty = items.reduce((acc, item) => acc + Number(item.quantity || 0), 0)

  return (
    <div className={cn("max-w-6xl mx-auto space-y-8 pb-20 transition-opacity", status === 'annulled' && "opacity-60 grayscale")}>
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-headline font-bold text-primary flex items-center gap-3">
            {status === 'active' ? 'Nueva Cotización' : 'Venta Anulada'}
            <Sparkles className="w-6 h-6 text-accent" />
          </h1>
          <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Punto de Venta Inteligente</p>
        </div>
        <div className="flex gap-2">
          {status === 'active' && items.length > 0 && (
            <Button variant="outline" className="rounded-xl border-destructive text-destructive hover:bg-destructive/10" onClick={handleAnnul}>
              <XCircle className="w-4 h-4 mr-2" /> Anular Venta
            </Button>
          )}
          <Button variant="outline" className="rounded-xl border-accent text-accent" size="icon"><Printer className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
            <CardHeader className="grid grid-cols-2 gap-4 pb-6 bg-accent/5 border-b border-accent/10">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-accent font-black tracking-[0.2em]">Serie Boleta</Label>
                <div className="text-2xl font-headline font-bold text-primary">{quoteId || "..."}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-accent font-black tracking-[0.2em]">Fecha Emisión</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-xs rounded-xl border-accent/20 font-bold" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-accent font-black tracking-[0.2em]">Hora</Label>
                  <Input value={time} readOnly className="h-9 text-xs bg-accent/5 rounded-xl border-accent/20 font-bold" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8 pt-8">
              <div className="relative space-y-2">
                <Label className="text-[10px] uppercase font-black text-accent tracking-widest ml-1">Cliente Solicitante</Label>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-5 rounded-[2rem] border-2 border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary/20">
                        {selectedCustomer.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-black text-xl text-primary">{selectedCustomer.name}</div>
                        <div className="text-[10px] text-accent font-mono uppercase font-bold tracking-widest">{selectedCustomer.id || "CL-XXX"}</div>
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
                          className="pl-11 h-12 rounded-[1.25rem] border-accent/20 focus:ring-accent font-medium text-lg"
                          value={customerQuery}
                          onChange={e => setCustomerQuery(e.target.value)}
                        />
                      </div>
                      <Button variant="outline" className="h-12 w-12 rounded-[1.25rem] border-accent text-accent hover:bg-accent/10"><UserPlus className="w-6 h-6" /></Button>
                    </div>
                    {customerSuggestions.length > 0 && (
                      <div className="absolute z-20 w-full mt-2 bg-white border border-accent/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden animate-in fade-in zoom-in-95">
                        {customerSuggestions.map(c => (
                          <button 
                            key={c.id} 
                            className="w-full text-left px-8 py-5 hover:bg-accent/5 transition-colors border-b last:border-0 group flex items-center justify-between"
                            onClick={() => {
                              setSelectedCustomer(c)
                              setCustomerQuery("")
                              setCustomerSuggestions([])
                            }}
                          >
                            <div>
                                <div className="font-black text-lg group-hover:text-primary transition-colors">{c.name}</div>
                                <div className="text-[10px] text-accent font-mono uppercase tracking-widest">{c.id}</div>
                            </div>
                            <Plus className="w-5 h-5 text-accent group-hover:text-primary" />
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
                  <ShoppingCart className="absolute left-4 top-4 h-5 w-5 text-accent" />
                  <Input 
                    placeholder="Escribe el nombre de la prenda..." 
                    className="pl-12 h-14 rounded-[1.25rem] border-accent/20 focus:ring-accent font-medium text-lg"
                    value={productQuery}
                    onChange={e => setProductQuery(e.target.value)}
                  />
                </div>
                {productSuggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-2 bg-white border border-accent/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden animate-in fade-in zoom-in-95">
                    {productSuggestions.map(p => (
                      <button 
                        key={p.id} 
                        className="w-full text-left px-8 py-5 hover:bg-accent/5 flex items-center justify-between border-b last:border-0 group"
                        onClick={() => addItem(p)}
                      >
                        <div className="flex items-center gap-5">
                          <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-accent/10 shadow-sm">
                              {p.imageUrl && <Image src={p.imageUrl} alt="" fill className="object-cover" />}
                          </div>
                          <div>
                            <div className="font-black text-lg group-hover:text-primary transition-colors">{p.name}</div>
                            <div className="text-[10px] text-accent uppercase font-black tracking-widest">Disponible Almacén: {p.stock}</div>
                          </div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <Plus className="w-6 h-6" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {items.map(item => (
                  <div key={item.id} className="flex flex-col md:flex-row gap-6 p-6 rounded-[2.5rem] border-2 border-primary/5 bg-gradient-to-r from-accent/5 to-white relative group transition-all hover:border-primary/20 hover:shadow-xl">
                    <div className="flex gap-6 flex-1">
                      <div className="relative w-24 h-24 rounded-[2rem] overflow-hidden bg-white shadow-md border border-accent/10 shrink-0">
                          <Image src={item.img || "https://picsum.photos/seed/item/200/200"} alt="" fill className="object-cover" data-ai-hint="fashion clothes" />
                      </div>
                      <div className="space-y-4 flex-1">
                        <div>
                          <div className="font-black text-xl text-primary">{item.name}</div>
                          <div className="text-[10px] text-accent font-black uppercase tracking-[0.2em] bg-accent/10 px-2 py-0.5 rounded-full inline-block mt-1">Stock Almacén: {item.stock}</div>
                        </div>
                        <div className="flex items-center gap-4 pt-1">
                           <Select 
                            value={item.priceType} 
                            onValueChange={(v: any) => updateItem(item.id, { priceType: v, price: v === 'fardo' ? 70 : v === 'mayor' ? 85 : 100 })}
                          >
                             <SelectTrigger className="h-10 w-36 rounded-xl border-accent/20 bg-white font-bold text-accent">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent className="rounded-2xl">
                               <SelectItem value="fardo" className="rounded-xl">Precio Fardo</SelectItem>
                               <SelectItem value="mayor" className="rounded-xl">Al Mayor</SelectItem>
                               <SelectItem value="unidad" className="rounded-xl">Por Unidad</SelectItem>
                             </SelectContent>
                           </Select>
                           <div className="relative">
                            <span className="absolute left-4 top-2.5 text-[10px] text-accent font-black">S/</span>
                            <Input 
                              type="number" 
                              value={item.price} 
                              onChange={e => updateItem(item.id, { price: e.target.value })}
                              className="h-10 w-28 pl-9 rounded-xl border-accent/20 bg-white font-black text-lg text-primary"
                              placeholder=""
                            />
                           </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-8 px-6 md:border-l-2 border-accent/10">
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black text-accent uppercase tracking-widest text-center block">Cantidad</Label>
                         <Input 
                          type="number" 
                          max={item.stock}
                          value={item.quantity} 
                          onChange={e => updateItem(item.id, { quantity: e.target.value })}
                          className="h-14 w-24 text-center rounded-[1.25rem] border-accent/20 font-black text-2xl focus:ring-accent text-primary"
                          placeholder=""
                        />
                      </div>
                      <div className="text-right min-w-[120px]">
                        <div className="text-[10px] text-accent font-black uppercase tracking-widest mb-1">Total Item</div>
                        <div className="text-2xl font-black text-primary">S/ {(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-12 w-12 text-destructive rounded-full hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="w-6 h-6" />
                      </Button>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="py-24 text-center border-4 border-dashed rounded-[3.5rem] border-accent/10 text-accent/40 flex flex-col items-center gap-6">
                    <div className="w-24 h-24 rounded-[2.5rem] bg-accent/5 flex items-center justify-center">
                        <ShoppingCart className="w-12 h-12 opacity-20" />
                    </div>
                    <span className="font-headline font-black text-2xl tracking-tight">Selecciona prendas para cotizar</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-primary via-primary to-accent text-white border-none shadow-[0_30px_60px_rgba(255,0,127,0.3)] rounded-[3rem] overflow-hidden relative group">
            <div className="absolute -top-10 -right-10 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
              <ShoppingCart className="w-64 h-64" />
            </div>
            <CardHeader className="pb-4 pt-8 px-10">
              <CardTitle className="text-white/60 uppercase text-[10px] font-black tracking-[0.4em]">Resumen de Proforma</CardTitle>
            </CardHeader>
            <CardContent className="space-y-10 relative z-10 pt-4 px-10">
              <div className="flex justify-between items-end border-b border-white/20 pb-10">
                <div>
                  <div className="text-[10px] uppercase font-black opacity-60 tracking-[0.2em]">Unidades</div>
                  <div className="font-headline font-black text-6xl tracking-tighter">{totalQty}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-black opacity-60 tracking-[0.2em]">Total Pagar</div>
                  <div className="font-headline font-black text-7xl tracking-tighter drop-shadow-lg">S/ {total.toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-5 pt-2">
                <div className="flex justify-between text-base">
                  <span className="opacity-70 font-bold uppercase tracking-widest text-xs">Subtotal Proforma</span>
                  <span className="font-black text-xl">S/ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-70 font-bold uppercase tracking-widest text-xs">Descuento Diva</span>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-[10px] text-white/50 font-black">S/</span>
                    <input 
                      type="number" 
                      value={discount} 
                      onChange={e => setDiscount(e.target.value)}
                      className="w-32 h-10 pl-8 text-lg bg-white/20 border-none text-white text-right font-black rounded-xl placeholder:text-white/30 focus:ring-2 focus:ring-white/40" 
                      placeholder=""
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pt-8 pb-10 px-10">
              <Button className="w-full h-16 bg-white text-primary hover:bg-white/90 font-black text-xl rounded-[1.5rem] border-none shadow-2xl active:scale-95 transition-all" onClick={() => toast({ title: "Venta Registrada", description: "La proforma se ha guardado y el stock se descontó." })}>
                <Save className="w-6 h-6 mr-3" />
                REGISTRAR VENTA
              </Button>
              <Button className="w-full h-14 bg-black/10 text-white hover:bg-black/20 border-2 border-white/20 font-black rounded-[1.5rem] tracking-widest" onClick={() => toast({ title: "WhatsApp Enviado", description: "Enviando PDF al cliente..." })}>
                <Share2 className="w-5 h-5 mr-3" />
                ENVIAR PROFORMA
              </Button>
            </CardFooter>
          </Card>
          
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
            <CardHeader className="bg-accent/5 py-4">
              <CardTitle className="text-[10px] font-black uppercase text-accent tracking-[0.3em]">Observaciones de Envío</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Textarea placeholder="Ej: Agencia Flores, Tallas L solamente..." className="text-base bg-accent/5 border-none rounded-[1.5rem] min-h-[120px] resize-none focus:ring-2 focus:ring-accent font-medium p-5" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}