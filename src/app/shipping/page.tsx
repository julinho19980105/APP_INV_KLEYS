
"use client"

import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Users, 
  Truck, 
  Calendar as CalendarIcon, 
  Search, 
  Plus, 
  ChevronDown, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  User,
  PackageCheck,
  X,
  Check
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useFirestore, useDoc, useCollection } from "@/firebase"
import { 
  doc, 
  setDoc, 
  serverTimestamp, 
  query, 
  collection, 
  orderBy, 
  limit, 
  where,
  updateDoc
} from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import CustomersHubPage from "../customers/page"

export default function ShippingHubPage() {
  const db = useFirestore()
  const { toast } = useToast()
  
  const [date, setDate] = React.useState<Date>(new Date())
  const [customerSearch, setCustomerSearch] = React.useState("")
  const [isSearchOpen, setIsSearchOpen] = React.useState(false)
  const [deleteConfirm, setDeleteConfirm] = React.useState<{id: string, name: string} | null>(null)

  const dateKey = format(date, "yyyy-MM-dd")
  const logisticsDocRef = React.useMemo(() => db ? doc(db, "logistics", dateKey) : null, [db, dateKey])
  const { data: logData } = useDoc(logisticsDocRef)
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#0296FF"

  // Consultar clientes y deudas para los balances
  const customersRef = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("id", "desc")) : null, [db])
  const { data: dbCustomers = [] } = useCollection(customersRef)
  const quotesAllRef = React.useMemo(() => db ? collection(db, "quotes") : null, [db])
  const paymentsAllRef = React.useMemo(() => db ? collection(db, "payments") : null, [db])
  const { data: allQuotes = [] } = useCollection(quotesAllRef)
  const { data: allPayments = [] } = useCollection(paymentsAllRef)

  const getCustomerBalance = (custId: string) => {
    const cQuotes = allQuotes.filter(q => q.customerId === custId && q.status !== 'annulled')
    const cPayments = allPayments.filter(p => p.customerId === custId)
    const totalInvoiced = cQuotes.reduce((acc, q) => acc + (q.total || 0), 0)
    const totalPaid = cPayments.reduce((acc, p) => acc + (p.amount || 0), 0)
    return totalPaid - totalInvoiced
  }

  // Clientes sugeridos (solo con cotizaciones activas)
  const activeCustomerSuggestions = React.useMemo(() => {
    const activeCustIds = new Set(allQuotes.filter(q => q.status === 'active').map(q => q.customerId))
    return dbCustomers.filter(c => activeCustIds.has(c.id))
  }, [dbCustomers, allQuotes])

  const filteredSuggestions = React.useMemo(() => {
    const q = customerSearch.toLowerCase()
    return activeCustomerSuggestions.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
  }, [activeCustomerSuggestions, customerSearch])

  const handleAddCustomer = async (customer: any) => {
    if (!db || !logisticsDocRef) return

    const customerQuotes = allQuotes.filter(q => q.customerId === customer.id && q.status === "active")
    const customerPayments = allPayments.filter(p => p.customerId === customer.id && !p.isLocked)

    if (customerQuotes.length === 0 && customerPayments.length === 0) {
      toast({ title: "Sin registros activos", description: "No hay documentos pendientes para este cliente." })
      return
    }

    const newEntry = {
      customerId: customer.id,
      customerName: customer.name,
      addedAt: new Date().toISOString(),
      quotes: customerQuotes.map(q => ({
        quoteId: q.id,
        amount: q.total,
        selected: true
      })),
      payments: customerPayments.map(p => ({
        paymentId: p.id,
        amount: p.amount,
        selected: true
      }))
    }

    const currentEntries = logData?.entries || []
    if (currentEntries.some((e: any) => e.customerId === customer.id)) {
      toast({ title: "Ya en lista" })
      return
    }

    await setDoc(logisticsDocRef, {
      date: dateKey,
      entries: [...currentEntries, newEntry],
      updatedAt: serverTimestamp()
    }, { merge: true })

    // Cambiar estados
    for (const q of customerQuotes) await updateDoc(doc(db, "quotes", q.id), { status: 'shipped' })
    for (const p of customerPayments) await updateDoc(doc(db, "payments", p.id), { isLocked: true })

    setCustomerSearch("")
    setIsSearchOpen(false)
    toast({ title: "Cliente Añadido al Lote" })
  }

  const handleToggleItem = async (customerId: string, itemId: string, type: 'quote' | 'payment') => {
    if (!db || !logisticsDocRef || !logData) return
    
    let isSelected = false
    const updatedEntries = logData.entries.map((entry: any) => {
      if (entry.customerId === customerId) {
        if (type === 'quote') {
          return {
            ...entry,
            quotes: entry.quotes.map((q: any) => {
              if (q.quoteId === itemId) { isSelected = !q.selected; return { ...q, selected: isSelected }; }
              return q
            })
          }
        } else {
          return {
            ...entry,
            payments: entry.payments.map((p: any) => {
              if (p.paymentId === itemId) { isSelected = !p.selected; return { ...p, selected: isSelected }; }
              return p
            })
          }
        }
      }
      return entry
    })

    await updateDoc(logisticsDocRef, { entries: updatedEntries, updatedAt: serverTimestamp() })
    
    if (type === 'quote') await updateDoc(doc(db, "quotes", itemId), { status: isSelected ? 'shipped' : 'active' })
    else await updateDoc(doc(db, "payments", itemId), { isLocked: isSelected })
  }

  const handleRemoveEntry = async () => {
    if (!db || !logisticsDocRef || !logData || !deleteConfirm) return
    
    const entryToRemove = logData.entries.find((e: any) => e.customerId === deleteConfirm.id)
    if (entryToRemove) {
      for (const q of entryToRemove.quotes) await updateDoc(doc(db, "quotes", q.quoteId), { status: 'active' })
      for (const p of (entryToRemove.payments || [])) await updateDoc(doc(db, "payments", p.paymentId), { isLocked: false })
    }

    const updatedEntries = logData.entries.filter((e: any) => e.customerId !== deleteConfirm.id)
    await updateDoc(logisticsDocRef, { entries: updatedEntries, updatedAt: serverTimestamp() })
    
    setDeleteConfirm(null)
    toast({ title: "Registro removido del lote" })
  }

  return (
    <div className="w-full max-w-6xl mx-auto pt-2 pb-24">
      <Tabs defaultValue="envios" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-16 bg-white border-b-2 border-primary/20 rounded-none mb-6 sticky top-0 z-50 shadow-sm p-1">
          <TabsTrigger value="clientes" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white font-black text-xs uppercase transition-all flex items-center gap-2">
            <Users className="w-4 h-4" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="envios" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white font-black text-xs uppercase transition-all flex items-center gap-2">
            <Truck className="w-4 h-4" /> Envios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="mt-0 focus-visible:outline-none">
          <CustomersHubPage />
        </TabsContent>

        <TabsContent value="envios" className="mt-0 focus-visible:outline-none space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-2 border-primary/10 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-primary/20" style={{ backgroundColor: brandColor }}>
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-headline font-black text-foreground uppercase tracking-tight">Despacho Diario</h1>
                <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mt-0.5">Control de Lotes y Logística</p>
              </div>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 px-6 rounded-xl border-primary/10 font-black text-[10px] uppercase gap-3 bg-white shadow-sm">
                  <CalendarIcon className="w-4 h-4 text-primary" />
                  {format(date, "PPPP", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl border-primary/10 shadow-2xl" align="end">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus locale={es} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="relative">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center">
              <Search className="w-4 h-4 text-primary" />
            </div>
            <Input 
              placeholder="BUSCAR CLIENTE CON VENTAS ACTIVAS..." 
              className="pl-16 h-16 rounded-2xl border-2 border-primary/10 font-black text-xs uppercase bg-white shadow-lg focus:ring-4 focus:ring-primary/10 transition-all"
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              onFocus={() => setIsSearchOpen(true)}
            />
            {isSearchOpen && (
              <div className="absolute z-50 w-full mt-3 bg-white border-2 border-primary/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-3 bg-primary/5 border-b border-primary/5 flex justify-between items-center px-6">
                  <span className="text-[9px] font-black uppercase text-primary tracking-widest">Pendientes de Envío</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsSearchOpen(false)}><X className="w-3 h-3" /></Button>
                </div>
                <div className="max-h-[250px] overflow-y-auto">
                  {filteredSuggestions.map(c => (
                    <button key={c.id} className="w-full text-left px-8 py-4 hover:bg-primary/5 border-b border-primary/5 last:border-0 flex items-center justify-between group" onClick={() => handleAddCustomer(c)}>
                      <div className="flex flex-col">
                        <span className="font-black text-[12px] uppercase">{c.name}</span>
                        <span className="text-[8px] font-bold text-primary/40 uppercase tracking-widest">{c.id}</span>
                      </div>
                      <Plus className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ))}
                  {filteredSuggestions.length === 0 && (
                    <div className="p-8 text-center text-[9px] font-black uppercase opacity-20">Sin clientes con boletas activas</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Card className="rounded-[2rem] border-none shadow-xl bg-white overflow-hidden">
            <div className="bg-primary/5 border-b border-primary/5 py-4 px-8 flex justify-between items-center">
              <span className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><PackageCheck className="w-4 h-4" /> Lote de Envío #{dateKey}</span>
              <Badge className="bg-primary text-white font-black text-[9px] px-4">{(logData?.entries || []).length} CLIENTES</Badge>
            </div>
            <CardContent className="p-0">
              {(logData?.entries || []).length === 0 ? (
                <div className="p-20 flex flex-col items-center justify-center opacity-10 space-y-4">
                  <Truck className="w-16 h-16" />
                  <span className="font-black text-xs uppercase tracking-[0.2em]">Lote Vacío</span>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {(logData?.entries || []).sort((a: any, b: any) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()).map((entry: any, index: number) => {
                    const balance = getCustomerBalance(entry.customerId)
                    const totalLote = entry.quotes.reduce((acc: number, q: any) => acc + (q.selected ? q.amount : 0), 0)
                    
                    return (
                      <AccordionItem key={entry.customerId} value={entry.customerId} className="border-b last:border-0 border-primary/5 px-6">
                        <div className="flex items-center gap-4">
                          <span className="w-7 h-7 rounded-full bg-primary/5 text-primary flex items-center justify-center font-black text-[11px] shrink-0">{index + 1}</span>
                          <AccordionTrigger className="flex-1 hover:no-underline py-5">
                            <div className="flex items-center justify-between w-full pr-6">
                              <div className="flex flex-col text-left">
                                <span className="font-black text-[14px] uppercase tracking-tight text-foreground">{entry.customerName}</span>
                                <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest">{entry.customerId}</span>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="text-right flex flex-col items-end">
                                   <span className="text-[8px] font-black text-primary/40 uppercase tracking-widest mb-0.5">Lote S/</span>
                                   <span className="font-headline font-black text-base">S/ {totalLote.toFixed(1)}</span>
                                </div>
                                <div className={cn(
                                  "min-w-[80px] text-center px-3 py-1.5 rounded-xl font-black text-[10px] text-white shadow-sm",
                                  balance < 0 ? "bg-red-500" : balance > 0 ? "bg-blue-500" : "bg-green-500"
                                )}>
                                  {balance < 0 ? `DEUDA S/ ${Math.abs(balance).toFixed(0)}` : balance > 0 ? `FAVOR S/ ${balance.toFixed(0)}` : "SALDADO"}
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-primary/20 hover:text-destructive" onClick={() => setDeleteConfirm({ id: entry.customerId, name: entry.customerName })}><Trash2 className="w-4 h-4" /></Button>
                        </div>

                        <AccordionContent className="pb-6 pt-2 pl-12 border-t border-primary/5">
                          <div className="space-y-4 pt-4">
                            {/* Cotizaciones en Lote */}
                            <div className="space-y-2">
                              <Label className="text-[8px] font-black text-primary/40 uppercase tracking-widest ml-1">Cotizaciones en Envío</Label>
                              {entry.quotes.map((q: any) => (
                                <div key={q.quoteId} className={cn("flex items-center justify-between p-3 rounded-xl border", q.selected ? "bg-primary/[0.02] border-primary/10" : "bg-secondary/20 opacity-40 border-transparent")}>
                                  <div className="flex items-center gap-4">
                                    <Checkbox checked={q.selected} onCheckedChange={() => handleToggleItem(entry.customerId, q.quoteId, 'quote')} />
                                    <span className="text-[10px] font-black uppercase text-foreground">{q.quoteId} - S/ {Number(q.amount).toFixed(1)}</span>
                                  </div>
                                  <button onClick={() => handleToggleItem(entry.customerId, q.quoteId, 'quote')} className="text-primary/20 hover:text-destructive p-1"><X className="w-3.5 h-3.5" /></button>
                                </div>
                              ))}
                            </div>

                            {/* Pagos en Lote */}
                            {(entry.payments || []).length > 0 && (
                              <div className="space-y-2">
                                <Label className="text-[8px] font-black text-primary/40 uppercase tracking-widest ml-1">Pagos Procesados</Label>
                                {entry.payments.map((p: any) => (
                                  <div key={p.paymentId} className={cn("flex items-center justify-between p-3 rounded-xl border", p.selected ? "bg-green-50/30 border-green-200/30" : "bg-secondary/20 opacity-40 border-transparent")}>
                                    <div className="flex items-center gap-4">
                                      <Checkbox checked={p.selected} onCheckedChange={() => handleToggleItem(entry.customerId, p.paymentId, 'payment')} />
                                      <span className="text-[10px] font-black uppercase text-green-700">PAGO - S/ {Number(p.amount).toFixed(1)}</span>
                                    </div>
                                    <button onClick={() => handleToggleItem(entry.customerId, p.paymentId, 'payment')} className="text-primary/20 hover:text-destructive p-1"><X className="w-3.5 h-3.5" /></button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Sugerencias: Nuevos registros activos */}
                            {(() => {
                              const newQuotes = allQuotes.filter(q => q.customerId === entry.customerId && q.status === 'active')
                              const newPayments = allPayments.filter(p => p.customerId === entry.customerId && !p.isLocked)
                              if (newQuotes.length === 0 && newPayments.length === 0) return null;
                              
                              return (
                                <div className="p-4 bg-orange-50/50 rounded-2xl border border-dashed border-orange-200 space-y-2 mt-4">
                                  <div className="flex items-center gap-2 text-orange-600 mb-1">
                                    <AlertCircle className="w-3 h-3" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Registros Detectados Fuera del Lote</span>
                                  </div>
                                  {newQuotes.map(q => (
                                    <button key={q.id} className="w-full text-left px-4 py-2 bg-white rounded-lg text-[9px] font-black uppercase text-orange-700 border border-orange-100 flex justify-between items-center group" onClick={() => handleAddCustomer({ id: entry.customerId, name: entry.customerName })}>
                                      <span>NUEVA VENTA: {q.id} - S/ {q.total}</span>
                                      <Plus className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                                    </button>
                                  ))}
                                  {newPayments.map(p => (
                                    <button key={p.id} className="w-full text-left px-4 py-2 bg-white rounded-lg text-[9px] font-black uppercase text-green-700 border border-green-100 flex justify-between items-center group" onClick={() => handleAddCustomer({ id: entry.customerId, name: entry.customerName })}>
                                      <span>NUEVO COBRO: S/ {p.amount}</span>
                                      <Plus className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                                    </button>
                                  ))}
                                </div>
                              )
                            })()}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="rounded-3xl max-w-xs p-8 text-center border-none shadow-2xl">
          <DialogHeader><DialogTitle className="text-xs font-black uppercase text-destructive tracking-widest text-center">¿Remover del Lote?</DialogTitle></DialogHeader>
          <p className="text-[11px] font-black text-foreground uppercase mt-4">Se quitará a <span className="text-primary">{deleteConfirm?.name}</span> de los envíos de hoy.</p>
          <div className="grid grid-cols-2 gap-3 mt-8">
            <Button variant="outline" className="h-12 rounded-xl font-black text-[10px] uppercase border-primary/10" onClick={() => setDeleteConfirm(null)}>CANCELAR</Button>
            <Button className="h-12 bg-destructive text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-destructive/20" onClick={handleRemoveEntry}>CONFIRMAR</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
