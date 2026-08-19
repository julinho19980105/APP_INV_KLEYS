
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
import { Trash2, Plus, Search, ShoppingCart, Share2, Save, Printer, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useFirestore, useCollection } from "@/firebase"
import { collection, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, increment, getDocs, limit, setDoc } from "firebase/firestore"

interface QuoteItem {
  id: string
  productId: string
  name: string
  description: string
  quantity: number | string
  price: number | string
  priceType: 'fardo' | 'mayor' | 'unidad'
  stock: number
  img: string
}

// Lista estática de clientes para búsqueda (En producción vendría de una colección 'customers')
const MOCK_CUSTOMERS = [
  { id: "CL-001", name: "ANA MARIA GARCIA" },
  { id: "CL-002", name: "CARLOS ROBERTO" },
  { id: "CL-003", name: "BEATRIZ MENDOZA" },
  { id: "CL-004", name: "JUAN PEREZ SAC" },
  { id: "CL-005", name: "TIENDA DIVA LIMA" },
]

export default function QuotesPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [saving, setSaving] = React.useState(false)
  const [date, setDate] = React.useState("")
  const [time, setTime] = React.useState("")
  const [quoteId, setQuoteId] = React.useState("B-001")
  
  const [customerQuery, setCustomerQuery] = React.useState("")
  const [selectedCustomerName, setSelectedCustomerName] = React.useState("")

  const [productQuery, setProductQuery] = React.useState("")
  const [items, setItems] = React.useState<QuoteItem[]>([])
  const [discount, setDiscount] = React.useState<string | number>("")

  const productsRef = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code")) : null, [db])
  const { data: dbProducts = [] } = useCollection(productsRef)

  const fetchNextQuoteId = React.useCallback(async () => {
    if (!db) return
    const q = query(collection(db, "quotes"), orderBy("id", "desc"), limit(1))
    const snap = await getDocs(q)
    if (!snap.empty) {
      const lastId = snap.docs[0].id
      const match = lastId.match(/\d+/)
      const lastNum = match ? parseInt(match[0]) : 0
      setQuoteId(`B-${(lastNum + 1).toString().padStart(3, '0')}`)
    } else {
      setQuoteId("B-001")
    }
  }, [db])

  React.useEffect(() => {
    setDate(new Date().toISOString().split('T')[0])
    setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    fetchNextQuoteId()
  }, [fetchNextQuoteId])

  // Filtrado de Clientes (Código Puro)
  const customerSuggestions = React.useMemo(() => {
    if (customerQuery.length < 2) return []
    const q = customerQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return MOCK_CUSTOMERS.filter(c => 
      c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) ||
      c.id.toLowerCase().includes(q)
    )
  }, [customerQuery])

  // Filtrado de Productos (Código Puro)
  const productSuggestions = React.useMemo(() => {
    if (productQuery.length < 2) return []
    const q = productQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return dbProducts.filter(p => 
      p.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) ||
      p.code?.toLowerCase().includes(q)
    )
  }, [productQuery, dbProducts])

  const addItem = (prod: any) => {
    if (items.find(i => i.productId === prod.id)) return
    setItems([...items, {
      id: Math.random().toString(),
      productId: prod.code,
      name: prod.name,
      description: "",
      quantity: "",
      price: prod.priceMayor || "",
      priceType: 'mayor',
      stock: prod.stock,
      img: prod.images?.[0] || ""
    }])
    setProductQuery("")
  }

  const updateItem = (id: string, updates: Partial<QuoteItem>) => {
    setItems(items.map(i => i.id === id ? { ...i, ...updates } : i))
  }

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id))
  }

  const handleRegisterSale = async () => {
    if (!db || items.length === 0 || !selectedCustomerName) return
    setSaving(true)
    try {
      await setDoc(doc(db, "quotes", quoteId), {
        id: quoteId,
        customer: selectedCustomerName.toUpperCase(),
        items,
        subtotal,
        discount: Number(discount || 0),
        total,
        status: 'active',
        createdAt: serverTimestamp()
      })

      for (const item of items) {
        const qty = Number(item.quantity)
        const pRef = doc(db, "products", item.productId)
        updateDoc(pRef, { stock: increment(-qty) })
        addDoc(collection(db, "movements"), {
          productCode: item.productId,
          type: "out",
          quantity: qty,
          reason: `VENTA SERIE ${quoteId}`,
          timestamp: serverTimestamp()
        })
      }

      toast({ title: "SERIE REGISTRADA", description: `PROFORMA ${quoteId} GUARDADA.` })
      setItems([])
      setSelectedCustomerName("")
      setCustomerQuery("")
      fetchNextQuoteId()
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR", description: "FALLA AL REGISTRAR." })
    } finally {
      setSaving(false)
    }
  }

  const subtotal = items.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.price || 0)), 0)
  const total = subtotal - Number(discount || 0)
  const totalQty = items.reduce((acc, item) => acc + Number(item.quantity || 0), 0)

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 pt-2">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-headline font-black text-black flex items-center gap-3">
            COTIZACIÓN SERIE <span className="text-primary">{quoteId}</span>
          </h1>
          <p className="text-[10px] font-black text-black/40 uppercase tracking-[0.3em] ml-1">Kardex Pro Diva Industrial</p>
        </div>
        <Button variant="outline" className="rounded-xl border-black text-black font-black" size="icon"><Printer className="w-4 h-4" /></Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-[2.5rem] border shadow-sm overflow-hidden bg-white">
            <CardHeader className="grid grid-cols-2 gap-4 pb-6 bg-black/5 border-b">
              <div className="space-y-1">
                <Label className="text-[9px] uppercase text-black font-black tracking-widest">Identidad del Cliente</Label>
                <div className="relative">
                  <Input 
                    placeholder="ESCRIBIR NOMBRE..." 
                    className="h-10 text-sm font-black text-black uppercase rounded-xl border-black/10"
                    value={customerQuery || selectedCustomerName}
                    onChange={e => {
                      setCustomerQuery(e.target.value)
                      setSelectedCustomerName(e.target.value)
                    }}
                  />
                  {customerSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-xl overflow-hidden">
                      {customerSuggestions.map(c => (
                        <button 
                          key={c.id} 
                          className="w-full text-left px-4 py-3 hover:bg-black/5 text-[11px] font-black uppercase border-b last:border-0"
                          onClick={() => {
                            setSelectedCustomerName(c.name)
                            setCustomerQuery("")
                          }}
                        >
                          {c.name} <span className="text-[8px] opacity-40 ml-2">[{c.id}]</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-black font-black tracking-widest">Fecha</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-10 text-[10px] rounded-xl border-black/10 font-black" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-black font-black tracking-widest">Hora</Label>
                  <Input value={time} readOnly className="h-10 text-[10px] bg-black/5 rounded-xl border-none font-black" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8 pt-8">
              <div className="relative space-y-2">
                <Label className="text-[9px] uppercase font-black text-black tracking-widest ml-1">Buscador de Prendas</Label>
                <div className="relative">
                  <Search className="absolute left-4 top-4 h-5 w-5 text-black/40" />
                  <Input 
                    placeholder="BUSCAR NOMBRE O DNI..." 
                    className="pl-12 h-14 rounded-[1.25rem] border-black/10 font-black text-sm uppercase text-black"
                    value={productQuery}
                    onChange={e => setProductQuery(e.target.value)}
                  />
                </div>
                {productSuggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-2 bg-white border border-black/10 rounded-[2rem] shadow-2xl overflow-hidden">
                    {productSuggestions.map(p => (
                      <button 
                        key={p.id} 
                        className="w-full text-left px-8 py-5 hover:bg-black/5 flex items-center justify-between border-b last:border-0 group"
                        onClick={() => addItem(p)}
                      >
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-xl overflow-hidden border bg-muted">
                            {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div>
                            <div className="font-black text-base text-black uppercase">{p.name}</div>
                            <div className="text-[9px] text-black/40 uppercase font-black">STOCK: {p.stock} | DNI: {p.code}</div>
                          </div>
                        </div>
                        <Plus className="w-5 h-5 text-black/20 group-hover:text-primary" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {items.map(item => (
                  <div key={item.id} className="p-5 rounded-[2rem] border-2 border-black/5 bg-white transition-all hover:border-black/20">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                      <div className="md:col-span-2">
                        <div className="aspect-square rounded-2xl overflow-hidden bg-muted border border-black/5">
                            <img src={item.img || "https://picsum.photos/seed/item/200/200"} alt="" className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div className="md:col-span-5 space-y-3">
                        <div>
                          <div className="font-black text-lg text-black uppercase leading-tight">{item.name}</div>
                          <div className="text-[9px] text-black/40 font-black uppercase tracking-widest mt-1">DNI: {item.productId}</div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[8px] font-black uppercase text-black/40 ml-1">Observaciones Prenda</Label>
                          <Input 
                            value={item.description}
                            onChange={e => updateItem(item.id, { description: e.target.value })}
                            placeholder="TALLE, COLOR, ETC..."
                            className="h-8 text-[9px] font-black uppercase rounded-lg border-black/10 bg-black/5 text-black"
                          />
                        </div>
                      </div>
                      <div className="md:col-span-5 flex flex-col justify-between border-l border-black/5 pl-5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 space-y-1">
                            <Label className="text-[8px] font-black uppercase text-black/40 ml-1">Tarifa Diva</Label>
                            <Select 
                              value={item.priceType} 
                              onValueChange={(v: any) => {
                                const prod = dbProducts.find(p => p.code === item.productId)
                                let newP = prod?.priceMayor
                                if (v === 'fardo') newP = prod?.priceFardo
                                if (v === 'unidad') newP = prod?.priceUnidad
                                updateItem(item.id, { priceType: v, price: newP })
                              }}
                            >
                              <SelectTrigger className="h-9 rounded-lg border-black/10 bg-white font-black text-[9px] text-black uppercase">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fardo" className="text-[9px] font-black">FARDO</SelectItem>
                                <SelectItem value="mayor" className="text-[9px] font-black">MAYOR</SelectItem>
                                <SelectItem value="unidad" className="text-[9px] font-black">UNIDAD</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-20 space-y-1">
                            <Label className="text-[8px] font-black uppercase text-black/40 ml-1">P. Unit</Label>
                            <Input 
                              type="number" 
                              value={item.price} 
                              onChange={e => updateItem(item.id, { price: e.target.value })}
                              className="h-9 font-black text-xs text-center border-black/10 rounded-lg text-black"
                            />
                          </div>
                          <div className="w-16 space-y-1">
                            <Label className="text-[8px] font-black uppercase text-black/40 ml-1">Cant</Label>
                            <Input 
                              type="number" 
                              value={item.quantity} 
                              onChange={e => updateItem(item.id, { quantity: e.target.value })}
                              className="h-9 font-black text-xs text-center border-primary rounded-lg text-primary bg-primary/5"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-black/5 mt-3">
                          <div className="text-[18px] font-black text-black">S/ {(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="py-20 text-center border-2 border-dashed rounded-[2.5rem] border-black/10 text-black/20 flex flex-col items-center gap-3">
                    <ShoppingCart className="w-10 h-10 opacity-10" />
                    <span className="font-black text-[10px] uppercase tracking-widest">Sin prendas agregadas</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-black text-white border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
            <CardHeader className="pb-4 pt-8 px-8">
              <CardTitle className="text-white/40 uppercase text-[9px] font-black tracking-[0.4em]">Liquidación Pro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 pt-4 px-8">
              <div className="flex justify-between items-end border-b border-white/10 pb-8">
                <div>
                  <div className="text-[9px] uppercase font-black text-white/40">Cant</div>
                  <div className="font-headline font-black text-5xl tracking-tighter">{totalQty}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase font-black text-white/40">Total S/</div>
                  <div className="font-headline font-black text-6xl tracking-tighter">{total.toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex justify-between text-base">
                  <span className="text-white/40 font-black uppercase text-[9px]">Subtotal Bruto</span>
                  <span className="font-black text-lg">S/ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/40 font-black uppercase text-[9px]">Descuento Diva</span>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-[10px] text-white/40 font-black">S/</span>
                    <input 
                      type="number" 
                      value={discount} 
                      onChange={e => setDiscount(e.target.value)}
                      className="w-28 h-9 pl-7 text-base bg-white/10 border-none text-white text-right font-black rounded-lg focus:ring-1 focus:ring-white/40" 
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-6 pb-8 px-8">
              <Button 
                className="w-full h-14 bg-primary text-white hover:bg-primary/90 font-black text-base rounded-2xl shadow-xl active:scale-95 transition-all" 
                onClick={handleRegisterSale}
                disabled={saving || items.length === 0 || !selectedCustomerName}
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                REGISTRAR SERIE
              </Button>
              <Button className="w-full h-12 bg-white/5 text-white hover:bg-white/10 border border-white/10 font-black rounded-2xl text-[9px] uppercase tracking-widest">
                <Share2 className="w-4 h-4 mr-2" />
                GENERAR PDF
              </Button>
            </CardFooter>
          </Card>
          
          <Card className="rounded-[2.5rem] border shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-black/5 py-3">
              <CardTitle className="text-[9px] font-black uppercase text-black tracking-[0.3em]">Observaciones</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Textarea placeholder="DATOS DE ENVÍO O PAGO..." className="text-[10px] bg-black/5 border-none rounded-2xl min-h-[100px] font-black text-black p-4 uppercase" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
