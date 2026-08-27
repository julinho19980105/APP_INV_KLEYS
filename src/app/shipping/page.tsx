
"use client"

import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Users, 
  Truck, 
  Search, 
  Plus, 
  Trash2, 
  PackageCheck,
  X,
  History
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
} from "@/components/ui/dialog"
import { useFirestore, useDoc, useCollection } from "@/firebase"
import { 
  doc, 
  setDoc, 
  serverTimestamp, 
  query, 
  collection, 
  orderBy, 
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
    const quotesTotal = (entry.quotes || []).reduce((acc: number, q: any) => acc + (q.selected ? Number(q.amount) : 0), 0)
    const paymentsTotal = (entry.payments || []).reduce((acc: number, p: any) => acc + (p.selected ? Number(p.amount) : 0), 0)
    return paymentsTotal - (quotesTotal + shipping)
  }

  const batchTotal = React.useMemo(() => {
    return (logData?.entries || []).reduce((acc: number, entry: any) => {
      const balance = calculateEntryBalance(entry)
      return acc + Math.abs(balance)
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
      toast({ title: "YA ESTÁ EN LA LISTA" })
      return
    }

    await setDoc(logisticsDocRef, {
      date: dateKey,
      entries: [...currentEntries, newEntry],
      totalAmount: batchTotal,
      updatedAt: serverTimestamp()
    }, { merge: true })

    setCustomerSearch("")
    setIsSearchOpen(false)
    toast({ title: "CLIENTE AÑADIDO" })
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
    const updatedEntries = logData.entries.map((entry: any) => {
      if (entry.customerId === customerId) {
        if (type === 'quote') {
          return {
            ...entry,
            quotes: entry.quotes.map((q: any) => q.quoteId === itemId ? { ...q, selected: !q.selected } : q)
          }
        } else {
          return {
            ...entry,
            payments: entry.payments.map((p: any) => p.paymentId === itemId ? { ...p, selected: !p.selected } : p)
          }
        }
      }
      return entry
    })
    await updateDoc(logisticsDocRef, { entries: updatedEntries, updatedAt: serverTimestamp() })
  }

  const handleRemoveEntry = async () => {
    if (!db || !logisticsDocRef || !logData || !deleteConfirm) return
    const updatedEntries = logData.entries.filter((e: any) => e.customerId !== deleteConfirm.id)
    await updateDoc(logisticsDocRef, { entries: updatedEntries, updatedAt: serverTimestamp() })
    setDeleteConfirm(null)
    toast({ title: "REMOVIDO" })
  }

  return (
    <div className="w-full max-w-4xl mx-auto pt-1 pb-24 px-2 md:px-0">
      <Tabs defaultValue="envios" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12 bg-white border-b border-primary/10 rounded-none mb-4 sticky top-0 z-50 shadow-sm p-1">
          <TabsTrigger value="clientes" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white font-black text-[11px] uppercase transition-all flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="envios" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white font-black text-[11px] uppercase transition-all flex items-center gap-2">
            <Truck className="w-3.5 h-3.5" /> Envíos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="mt-0">
          <CustomersHubPage />
        </TabsContent>

        <TabsContent value="envios" className="mt-0 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 border-b-2 border-black pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-primary">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-headline font-black text-foreground uppercase tracking-tight leading-none">REGISTRO DE ENVÍOS</h1>
              </div>
            </div>
            
            <div className="flex items-center justify-between w-full md:w-auto gap-6">
              <div className="text-right flex flex-col items-end">
                <span className="text-[8px] font-black text-primary/40 uppercase tracking-widest">TOTAL</span>
                <div className="flex items-end gap-1">
                  <span className="text-[10px] font-black text-primary mb-0.5">S/</span>
                  <span className="text-2xl font-headline font-black text-foreground leading-none">{batchTotal.toFixed(1)}</span>
                </div>
              </div>
              <input 
                type="date"
                value={dateKey}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) setDate(new Date(val + "T12:00:00"));
                }}
                className="h-9 px-2 rounded-lg border border-black/10 font-black text-[10px] uppercase bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
            <Input 
              placeholder="BUSCAR CLIENTE ACTIVO..." 
              className="pl-11 h-11 w-full rounded-xl border-2 border-primary/10 font-black text-xs uppercase bg-white shadow-md focus:ring-2 focus:ring-primary/5 transition-all"
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              onFocus={() => setIsSearchOpen(true)}
            />
            {isSearchOpen && (
              <div className="absolute z-[999999] w-full mt-1 bg-white border-2 border-primary/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1">
                <div className="p-2 bg-primary/5 border-b border-primary/5 flex justify-between items-center px-4">
                  <span className="text-[8px] font-black uppercase text-primary tracking-widest">Sugerencias</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsSearchOpen(false)}><X className="w-3.5 h-3.5" /></Button>
                </div>
                <div className="max-h-[250px] overflow-y-auto">
                  {filteredSuggestions.map(c => (
                    <button key={c.id} className="w-full text-left px-5 py-3 hover:bg-primary/5 border-b border-primary/5 last:border-0 flex items-center justify-between group" onClick={() => handleAddCustomer(c)}>
                      <div className="flex flex-col">
                        <span className="font-black text-[11px] uppercase text-black">{c.name}</span>
                        <span className="text-[8px] font-bold text-primary/40 uppercase">{c.id}</span>
                      </div>
                      <Plus className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Card className="rounded-xl border-none shadow-lg bg-white overflow-hidden w-full">
            <div className="bg-primary/5 border-b border-primary/10 py-2.5 px-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-primary" />
                <span className="text-[9px] font-black uppercase text-primary tracking-widest">LOTE DEL DÍA</span>
              </div>
              <Badge className="bg-primary text-white font-black text-[8px] px-3 h-5 rounded-md">
                {(logData?.entries || []).length} CLIENTES
              </Badge>
            </div>
            <CardContent className="p-1">
              <Accordion type="single" collapsible className="w-full space-y-1">
                {(logData?.entries || []).sort((a: any, b: any) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()).map((entry: any, index: number) => {
                  const balance = calculateEntryBalance(entry)
                  return (
                    <AccordionItem key={entry.customerId} value={entry.customerId} className="border-2 border-primary/10 rounded-xl overflow-hidden bg-white shadow-sm">
                      <AccordionTrigger className="w-full hover:no-underline py-3 px-3 group">
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-md bg-primary/5 text-primary flex items-center justify-center font-black text-[10px] shrink-0 shadow-inner">{index + 1}</span>
                            <div className="flex flex-col text-left">
                              <span className="font-black text-[12px] uppercase text-black leading-tight">{entry.customerName}</span>
                              <span className="text-[8px] font-bold text-primary/40 uppercase">{entry.customerId}</span>
                            </div>
                          </div>
                          <div className={cn(
                            "px-2.5 py-1 rounded-md font-black text-[11px] text-white shadow-sm ml-auto",
                            balance < -0.1 ? "bg-red-600" : balance > 0.1 ? "bg-blue-600" : "bg-green-600"
                          )}>
                            {Math.abs(balance).toFixed(1)}
                          </div>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="pb-3 pt-2 px-3 border-t border-primary/5 w-full bg-primary/[0.01]">
                        <div className="space-y-3">
                          <div className="flex items-center bg-white px-3 py-2 rounded-lg border border-primary/10 gap-3">
                            <Label className="text-[9px] font-black text-primary uppercase shrink-0">ENVÍO</Label>
                            <div className="relative flex-1">
                               <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-black text-[9px] text-primary/40">S/</span>
                               <Input 
                                  type="number" 
                                  placeholder="0.0" 
                                  value={entry.shippingCost || ""} 
                                  onChange={e => handleUpdateShippingCost(entry.customerId, e.target.value)}
                                  className="h-9 pl-7 text-xs font-black bg-primary/5 rounded border-none shadow-inner w-full" 
                                />
                            </div>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50 rounded-lg shrink-0" onClick={() => setDeleteConfirm({ id: entry.customerId, name: entry.customerName })}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-[8px] font-black text-black/40 uppercase tracking-widest ml-1">Ventas</Label>
                              {(entry.quotes || []).map((q: any) => (
                                <div key={q.quoteId} className={cn("flex items-center justify-between px-3 py-2 rounded-md border", q.selected ? "bg-white border-primary/20 shadow-sm" : "bg-black/5 opacity-40")}>
                                  <div className="flex items-center gap-2.5">
                                    <Checkbox checked={q.selected} onCheckedChange={() => handleToggleItem(entry.customerId, q.quoteId, 'quote')} className="h-4 w-4 border-2 border-primary rounded" />
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-black uppercase text-black">{q.quoteId}</span>
                                      <span className="text-[9px] font-bold text-primary">S/ {Number(q.amount).toFixed(1)}</span>
                                    </div>
                                  </div>
                                  <button onClick={() => handleToggleItem(entry.customerId, q.quoteId, 'quote')} className="p-1 text-black/20 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                                </div>
                              ))}
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[8px] font-black text-black/40 uppercase tracking-widest ml-1">Pagos</Label>
                              {(entry.payments || []).map((p: any) => (
                                <div key={p.paymentId} className={cn("flex items-center justify-between px-3 py-2 rounded-md border", p.selected ? "bg-green-50 border-green-200 shadow-sm" : "bg-black/5 opacity-40")}>
                                  <div className="flex items-center gap-2.5">
                                    <Checkbox checked={p.selected} onCheckedChange={() => handleToggleItem(entry.customerId, p.paymentId, 'payment')} className="h-4 w-4 border-2 border-green-500 rounded" />
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-black uppercase text-green-800">COBRO</span>
                                      <span className="text-[9px] font-bold text-green-600">S/ {Number(p.amount).toFixed(1)}</span>
                                    </div>
                                  </div>
                                  <button onClick={() => handleToggleItem(entry.customerId, p.paymentId, 'payment')} className="p-1 text-black/20 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            </CardContent>
          </Card>

          <div className="pt-6 space-y-3">
            <div className="flex items-center gap-3 border-b-2 border-black pb-2">
              <History className="w-4 h-4 text-black/40" />
              <h2 className="text-sm font-headline font-black text-foreground uppercase tracking-tight">Historial de Lotes</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {historyBatches.map(batch => {
                const total = batch.totalAmount || 0
                const entries = batch.entries || []
                let hDebt = false, isZero = true;
                entries.forEach((e: any) => {
                  const b = calculateEntryBalance(e)
                  if (b < -0.1) { hDebt = true; isZero = false; }
                  else if (b > 0.1) { isZero = false; }
                })

                return (
                  <Card key={batch.date} className="rounded-xl border border-black/5 bg-white shadow-sm hover:border-primary/20 transition-all cursor-pointer group" onClick={() => { setDate(new Date(batch.date + "T12:00:00")); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                    <CardContent className="p-3 space-y-1">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black uppercase text-black">{batch.date}</span>
                          <span className="text-[8px] font-black text-primary/40 uppercase tracking-widest">{entries.length} CLIENTES</span>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[8px] font-black h-5 px-2.5 uppercase border-none rounded-md",
                          isZero ? "bg-slate-100 text-slate-500" : hDebt ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                        )}>
                          {isZero ? "CUADRADO" : hDebt ? "DEUDA" : "EXCEDENTE"}
                        </Badge>
                      </div>
                      <div className="text-right border-t border-black/5 pt-1">
                         <span className="font-headline font-black text-lg text-black group-hover:text-primary transition-colors">S/ {total.toFixed(1)}</span>
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
        <DialogContent className="rounded-[2rem] max-w-[280px] p-8 text-center border-none shadow-2xl bg-white">
          <div className="flex flex-col items-center gap-6">
             <p className="text-[10px] font-black uppercase text-black/60 leading-relaxed px-1">¿Remover del lote?</p>
             <div className="grid grid-cols-2 gap-3 w-full">
               <Button variant="outline" className="h-11 rounded-xl font-black text-[10px] uppercase" onClick={() => setDeleteConfirm(null)}>NO</Button>
               <Button className="h-11 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-red-600/20" onClick={handleRemoveEntry}>SÍ</Button>
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
