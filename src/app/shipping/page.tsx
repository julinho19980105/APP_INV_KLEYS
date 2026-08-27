"use client"

import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Users, 
  Truck, 
  Calendar as CalendarIcon, 
  Search, 
  Plus, 
  Trash2, 
  AlertCircle,
  PackageCheck,
  X,
  History,
  ChevronDown
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
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false)

  const dateKey = format(date, "yyyy-MM-dd")
  const logisticsDocRef = React.useMemo(() => db ? doc(db, "logistics", dateKey) : null, [db, dateKey])
  const { data: logData } = useDoc(logisticsDocRef)
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#0296FF"

  // Registro histórico de lotes
  const allLogisticsRef = React.useMemo(() => db ? query(collection(db, "logistics"), orderBy("date", "desc")) : null, [db])
  const { data: historyBatches = [] } = useCollection(allLogisticsRef)

  const customersRef = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("id", "desc")) : null, [db])
  const { data: dbCustomers = [] } = useCollection(customersRef)
  
  const allQuotesRef = React.useMemo(() => db ? collection(db, "quotes") : null, [db])
  const allPaymentsRef = React.useMemo(() => db ? collection(db, "payments") : null, [db])
  const { data: allQuotes = [] } = useCollection(allQuotesRef)
  const { data: allPayments = [] } = useCollection(allPaymentsRef)

  const activeCustomerSuggestions = React.useMemo(() => {
    const activeCustIds = new Set(allQuotes.filter(q => q.status === 'active').map(q => q.customerId))
    return dbCustomers.filter(c => activeCustIds.has(c.id))
  }, [dbCustomers, allQuotes])

  const filteredSuggestions = React.useMemo(() => {
    const q = customerSearch.toLowerCase()
    return activeCustomerSuggestions.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
  }, [activeCustomerSuggestions, customerSearch])

  const calculateEntryBalance = (entry: any) => {
    const shipping = Number(entry.shippingCost || 0)
    const quotesTotal = entry.quotes.reduce((acc: number, q: any) => acc + (q.selected ? Number(q.amount) : 0), 0)
    const paymentsTotal = (entry.payments || []).reduce((acc: number, p: any) => acc + (p.selected ? Number(p.amount) : 0), 0)
    return paymentsTotal - (quotesTotal + shipping)
  }

  const batchTotal = React.useMemo(() => {
    return (logData?.entries || []).reduce((acc: number, entry: any) => {
      const quotesTotal = entry.quotes.reduce((acc: number, q: any) => acc + (q.selected ? Number(q.amount) : 0), 0)
      const shipping = Number(entry.shippingCost || 0)
      return acc + quotesTotal + shipping
    }, 0)
  }, [logData])

  const handleAddCustomer = async (customer: any) => {
    if (!db || !logisticsDocRef) return

    const customerQuotes = allQuotes.filter(q => q.customerId === customer.id && q.status === "active")
    const customerPayments = allPayments.filter(p => p.customerId === customer.id && !p.isLocked)

    const newEntry = {
      customerId: customer.id,
      customerName: customer.name,
      addedAt: new Date().toISOString(),
      shippingCost: 0,
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
      totalAmount: batchTotal + newEntry.quotes.reduce((a, q) => a + q.amount, 0),
      updatedAt: serverTimestamp()
    }, { merge: true })

    for (const q of customerQuotes) await updateDoc(doc(db, "quotes", q.id), { status: 'shipped' })
    for (const p of customerPayments) await updateDoc(doc(db, "payments", p.id), { isLocked: true })

    setCustomerSearch("")
    setIsSearchOpen(false)
    toast({ title: "Cliente Añadido al Lote" })
  }

  const handleUpdateShippingCost = async (customerId: string, cost: string) => {
    if (!logisticsDocRef || !logData) return
    const val = Number(cost)
    const updatedEntries = logData.entries.map((e: any) => 
      e.customerId === customerId ? { ...e, shippingCost: isNaN(val) ? 0 : val } : e
    )
    await updateDoc(logisticsDocRef, { entries: updatedEntries, updatedAt: serverTimestamp() })
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
    toast({ title: "Registro removido" })
  }

  return (
    <div className="w-full max-w-6xl mx-auto pt-2 pb-24 px-2 md:px-0">
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
                <h1 className="text-2xl font-headline font-black text-foreground uppercase tracking-tight">Registro de Envíos</h1>
                <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mt-0.5">Gestión de Lotes Logísticos</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-right flex flex-col items-end">
                <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest">Total Lote Soles</span>
                <span className="text-2xl font-headline font-black text-foreground">S/ {batchTotal.toFixed(1)}</span>
              </div>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-12 px-6 rounded-xl border-primary/10 font-black text-[12px] uppercase gap-3 bg-white shadow-sm min-w-[200px]">
                    <CalendarIcon className="w-4 h-4 text-primary" />
                    {format(date, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="end">
                  <div className="p-4 bg-white">
                    <Calendar mode="single" selected={date} onSelect={(d) => { if(d) { setDate(d); setIsCalendarOpen(false); } }} initialFocus locale={es} />
                    <div className="flex justify-between border-t border-primary/5 pt-4 px-2">
                      <Button variant="ghost" className="text-[11px] font-black text-primary/40 uppercase hover:bg-primary/5" onClick={() => { setDate(new Date()); setIsCalendarOpen(false); }}>Borrar</Button>
                      <Button variant="ghost" className="text-[11px] font-black text-primary uppercase hover:bg-primary/5" onClick={() => { setDate(new Date()); setIsCalendarOpen(false); }}>Hoy</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="relative w-full">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center">
              <Search className="w-4 h-4 text-primary" />
            </div>
            <Input 
              placeholder="BUSCAR CLIENTE CON VENTAS ACTIVAS..." 
              className="pl-16 h-16 w-full rounded-2xl border-2 border-primary/10 font-black text-xs uppercase bg-white shadow-lg focus:ring-4 focus:ring-primary/10 transition-all"
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              onFocus={() => setIsSearchOpen(true)}
            />
            {isSearchOpen && (
              <div className="absolute z-[99999] w-full mt-3 bg-white border-2 border-primary/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-3 bg-primary/5 border-b border-primary/5 flex justify-between items-center px-6">
                  <span className="text-[9px] font-black uppercase text-primary tracking-widest">Sugerencias (Ventas Activas)</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsSearchOpen(false)}><X className="w-3 h-3" /></Button>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {filteredSuggestions.map(c => (
                    <button key={c.id} className="w-full text-left px-8 py-5 hover:bg-primary/5 border-b border-primary/5 last:border-0 flex items-center justify-between group" onClick={() => handleAddCustomer(c)}>
                      <div className="flex flex-col">
                        <span className="font-black text-[13px] uppercase">{c.name}</span>
                        <span className="text-[9px] font-bold text-primary/40 uppercase tracking-widest">{c.id}</span>
                      </div>
                      <Plus className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ))}
                  {filteredSuggestions.length === 0 && (
                    <div className="p-10 text-center text-[10px] font-black uppercase opacity-20 tracking-widest">Sin documentos activos</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden w-full">
            <div className="bg-primary/5 border-b border-primary/5 py-4 px-8 flex justify-between items-center">
              <span className="text-[11px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><PackageCheck className="w-5 h-5" /> Lote del Día</span>
              <Badge className="bg-primary text-white font-black text-[10px] px-6 h-7 rounded-xl">{(logData?.entries || []).length} CLIENTES</Badge>
            </div>
            <CardContent className="p-0">
              {(logData?.entries || []).length === 0 ? (
                <div className="p-24 flex flex-col items-center justify-center opacity-10 space-y-6">
                  <Truck className="w-20 h-20" />
                  <span className="font-black text-sm uppercase tracking-[0.3em]">Esperando Registros...</span>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {(logData?.entries || []).sort((a: any, b: any) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()).map((entry: any, index: number) => {
                    const balance = calculateEntryBalance(entry)
                    return (
                      <AccordionItem key={entry.customerId} value={entry.customerId} className="border-b last:border-0 border-primary/5 px-0">
                        <div className="flex items-center w-full px-8">
                          <span className="w-8 h-8 rounded-full bg-primary/5 text-primary flex items-center justify-center font-black text-[12px] shrink-0 mr-4">{index + 1}</span>
                          <AccordionTrigger className="flex-1 hover:no-underline py-6">
                            <div className="flex items-center justify-between w-full">
                              <div className="flex flex-col text-left">
                                <span className="font-black text-[15px] uppercase tracking-tight text-foreground">{entry.customerName}</span>
                                <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">{entry.customerId}</span>
                              </div>
                              <div className={cn(
                                "min-w-[100px] text-center px-4 py-2 rounded-xl font-black text-[12px] text-white shadow-md border-2",
                                balance < -0.1 ? "bg-red-500 border-red-600" : balance > 0.1 ? "bg-blue-500 border-blue-600" : "bg-green-500 border-green-600"
                              )}>
                                {Math.abs(balance).toFixed(1)}
                              </div>
                            </div>
                          </AccordionTrigger>
                        </div>

                        <AccordionContent className="pb-8 pt-2 px-8 border-t border-primary/5 w-full">
                          <div className="space-y-6 pt-6">
                            <div className="flex items-end justify-between bg-primary/5 p-6 rounded-[2rem] border border-primary/10">
                              <div className="flex-1 space-y-2">
                                <Label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Costo de Envío</Label>
                                <Input 
                                  type="number" 
                                  placeholder="0.0" 
                                  value={entry.shippingCost || ""} 
                                  onChange={e => handleUpdateShippingCost(entry.customerId, e.target.value)}
                                  className="h-14 w-40 text-lg font-black bg-white rounded-2xl border-primary/20 text-center" 
                                />
                              </div>
                              <Button variant="outline" className="h-14 px-8 rounded-2xl font-black text-xs text-destructive border-destructive/20 hover:bg-destructive/5" onClick={() => setDeleteConfirm({ id: entry.customerId, name: entry.customerName })}>
                                <Trash2 className="w-5 h-5 mr-3" /> REMOVER CLIENTE
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="space-y-3">
                                <Label className="text-[9px] font-black text-primary/40 uppercase tracking-widest ml-1">Documentos en Envío</Label>
                                {entry.quotes.map((q: any) => (
                                  <div key={q.quoteId} className={cn("flex items-center justify-between p-4 rounded-2xl border-2 transition-all", q.selected ? "bg-white border-primary/20 shadow-sm" : "bg-secondary/20 border-transparent opacity-40")}>
                                    <div className="flex items-center gap-4">
                                      <Checkbox checked={q.selected} onCheckedChange={() => handleToggleItem(entry.customerId, q.quoteId, 'quote')} className="h-5 w-5 border-2" />
                                      <span className="text-[11px] font-black uppercase text-foreground">{q.quoteId} - S/ {Number(q.amount).toFixed(1)}</span>
                                    </div>
                                    <button onClick={() => handleToggleItem(entry.customerId, q.quoteId, 'quote')} className="text-primary/30 hover:text-destructive p-2"><X className="w-4 h-4" /></button>
                                  </div>
                                ))}
                              </div>

                              <div className="space-y-3">
                                <Label className="text-[9px] font-black text-primary/40 uppercase tracking-widest ml-1">Cobros Aplicados</Label>
                                {(entry.payments || []).length === 0 ? (
                                  <div className="p-8 text-center border-2 border-dashed border-primary/10 rounded-2xl text-[9px] font-black uppercase opacity-20">Sin cobros en este lote</div>
                                ) : (
                                  entry.payments.map((p: any) => (
                                    <div key={p.paymentId} className={cn("flex items-center justify-between p-4 rounded-2xl border-2 transition-all", p.selected ? "bg-green-50 border-green-200/50 shadow-sm" : "bg-secondary/20 border-transparent opacity-40")}>
                                      <div className="flex items-center gap-4">
                                        <Checkbox checked={p.selected} onCheckedChange={() => handleToggleItem(entry.customerId, p.paymentId, 'payment')} className="h-5 w-5 border-2 border-green-400" />
                                        <span className="text-[11px] font-black uppercase text-green-700">COBRO - S/ {Number(p.amount).toFixed(1)}</span>
                                      </div>
                                      <button onClick={() => handleToggleItem(entry.customerId, p.paymentId, 'payment')} className="text-primary/30 hover:text-destructive p-2"><X className="w-4 h-4" /></button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            {/* Detección de Sugerencias */}
                            {(() => {
                              const newQuotes = allQuotes.filter(q => q.customerId === entry.customerId && q.status === 'active')
                              const newPayments = allPayments.filter(p => p.customerId === entry.customerId && !p.isLocked)
                              if (newQuotes.length === 0 && newPayments.length === 0) return null;
                              return (
                                <div className="p-6 bg-orange-50/50 rounded-[2rem] border-2 border-dashed border-orange-200 space-y-3">
                                  <div className="flex items-center gap-3 text-orange-600 mb-2">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Registros Detectados Fuera del Lote</span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {newQuotes.map(q => (
                                      <button key={q.id} className="w-full text-left px-5 py-3 bg-white rounded-xl text-[10px] font-black uppercase text-orange-700 border-2 border-orange-100 flex justify-between items-center group shadow-sm hover:border-orange-400" onClick={() => handleAddCustomer({ id: entry.customerId, name: entry.customerName })}>
                                        <span>AGREGAR VENTA: {q.id} - S/ {q.total.toFixed(1)}</span>
                                        <Plus className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                                      </button>
                                    ))}
                                    {newPayments.map(p => (
                                      <button key={p.id} className="w-full text-left px-5 py-3 bg-white rounded-xl text-[10px] font-black uppercase text-green-700 border-2 border-green-100 flex justify-between items-center group shadow-sm hover:border-green-400" onClick={() => handleAddCustomer({ id: entry.customerId, name: entry.customerName })}>
                                        <span>AGREGAR COBRO: S/ {p.amount.toFixed(1)}</span>
                                        <Plus className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                                      </button>
                                    ))}
                                  </div>
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

          {/* Registro Histórico de Lotes */}
          <div className="pt-10 space-y-6">
            <div className="flex items-center gap-3 border-b-2 border-primary/10 pb-4">
              <History className="w-6 h-6 text-primary/40" />
              <h2 className="text-xl font-headline font-black text-foreground uppercase tracking-tight">Registro de Lotes Anteriores</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {historyBatches.map(batch => {
                const total = batch.totalAmount || 0
                const entries = batch.entries || []
                let hasDebt = false
                let hasExcess = false
                let isZero = true

                entries.forEach((e: any) => {
                  const b = calculateEntryBalance(e)
                  if (b < -0.1) { hasDebt = true; isZero = false; }
                  else if (b > 0.1) { hasExcess = true; isZero = false; }
                })

                return (
                  <Card key={batch.date} className="rounded-2xl border border-primary/5 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => { setDate(new Date(batch.date + "T12:00:00")); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="text-[12px] font-black uppercase text-foreground">{format(new Date(batch.date + "T12:00:00"), "dd/MM/yyyy")}</span>
                          <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest">{entries.length} CLIENTES</span>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[9px] font-black h-5 px-3 uppercase border-none",
                          isZero ? "bg-slate-100 text-slate-500" : hasDebt ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                        )}>
                          {isZero ? "CUADRADO" : hasDebt ? "DEUDA" : "EXCEDENTE"}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-end border-t border-primary/5 pt-3">
                        <span className="text-[9px] font-black text-primary/30 uppercase">MONTO TOTAL LOTE</span>
                        <span className="font-headline font-black text-lg text-foreground">S/ {total.toFixed(1)}</span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="rounded-[2rem] max-w-xs p-8 text-center border-none shadow-2xl overflow-hidden bg-white">
          <div className="flex flex-col items-center gap-6">
             <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
               <Trash2 className="w-8 h-8" />
             </div>
             <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-destructive">¿Remover Cliente?</h3>
                <p className="text-[11px] font-black uppercase text-foreground leading-relaxed">Se quitará a <span className="text-primary">{deleteConfirm?.name}</span> y se liberarán sus documentos.</p>
             </div>
             <div className="grid grid-cols-2 gap-3 w-full">
               <Button variant="outline" className="h-12 rounded-xl font-black text-[10px] uppercase border-primary/10" onClick={() => setDeleteConfirm(null)}>NO</Button>
               <Button className="h-12 bg-destructive text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-destructive/20" onClick={handleRemoveEntry}>SÍ</Button>
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}