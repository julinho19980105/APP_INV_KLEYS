
"use client"

import * as React from "react"
import { 
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

export default function ShippingPage() {
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
  const brandColor = config?.brandColor || "#FF3399"

  const customersQuery = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("id", "desc"), limit(50)) : null, [db])
  const { data: dbCustomers = [] } = useCollection(customersQuery)

  const recentDate = React.useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d
  }, [])

  const activeQuotesQuery = React.useMemo(() => db ? query(
    collection(db, "quotes"), 
    where("status", "in", ["active", "shipped"]),
    where("createdAt", ">=", recentDate)
  ) : null, [db, recentDate])
  
  const { data: activeQuotes = [] } = useCollection(activeQuotesQuery)

  const recentLogsQuery = React.useMemo(() => db ? query(collection(db, "logistics"), orderBy("updatedAt", "desc"), limit(5)) : null, [db])
  const { data: recentLogs = [] } = useCollection(recentLogsQuery)

  const filteredSearchCustomers = React.useMemo(() => {
    const q = customerSearch.toLowerCase()
    return dbCustomers.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
  }, [dbCustomers, customerSearch])

  const logEntries = React.useMemo(() => {
    return (logData?.entries || []).sort((a: any, b: any) => 
      new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
    )
  }, [logData])

  const handleAddCustomer = async (customer: any) => {
    if (!db || !logisticsDocRef) return

    const customerQuotes = activeQuotes.filter(q => q.customerId === customer.id && q.status === "active")
    if (customerQuotes.length === 0) {
      toast({ title: "Sin boletas", description: "No hay boletas activas recientes para este cliente." })
      return
    }

    const newEntry = {
      customerId: customer.id,
      customerName: customer.name,
      addedAt: new Date().toISOString(),
      quotes: customerQuotes.map(q => ({
        quoteId: q.id,
        amount: q.total,
        quantity: q.items.reduce((acc: number, i: any) => acc + (Number(i.quantity) || 0), 0),
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

    for (const q of customerQuotes) {
      updateDoc(doc(db, "quotes", q.id), { status: 'shipped' })
    }

    setCustomerSearch("")
    setIsSearchOpen(false)
    toast({ title: "Cliente Añadido" })
  }

  const handleToggleQuote = async (customerId: string, quoteId: string) => {
    if (!db || !logisticsDocRef || !logData) return
    
    let nextStatus = 'active'
    const updatedEntries = logData.entries.map((entry: any) => {
      if (entry.customerId === customerId) {
        return {
          ...entry,
          quotes: entry.quotes.map((q: any) => {
            if (q.quoteId === quoteId) {
              const isSelected = !q.selected
              nextStatus = isSelected ? 'shipped' : 'active'
              return { ...q, selected: isSelected }
            }
            return q
          })
        }
      }
      return entry
    })

    await updateDoc(logisticsDocRef, { entries: updatedEntries, updatedAt: serverTimestamp() })
    await updateDoc(doc(db, "quotes", quoteId), { status: nextStatus })
  }

  const handleDeleteEntry = async () => {
    if (!db || !logisticsDocRef || !logData || !deleteConfirm) return
    
    const entryToRemove = logData.entries.find((e: any) => e.customerId === deleteConfirm.id)
    if (entryToRemove) {
      for (const q of entryToRemove.quotes) {
        updateDoc(doc(db, "quotes", q.quoteId), { status: 'active' })
      }
    }

    const updatedEntries = logData.entries.filter((e: any) => e.customerId !== deleteConfirm.id)
    await updateDoc(logisticsDocRef, { entries: updatedEntries, updatedAt: serverTimestamp() })
    
    setDeleteConfirm(null)
    toast({ title: "Registro Eliminado" })
  }

  return (
    <div className="space-y-6 pt-4 pb-24 px-2 md:px-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-2 border-primary/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl flex items-center justify-center shadow-xl shadow-primary/20" style={{ backgroundColor: brandColor }}>
            <Truck className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-headline font-black text-foreground uppercase tracking-tight">Despacho Diario</h1>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="w-3 h-3 text-primary/40" />
              <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest">Control Logístico</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-12 px-6 rounded-2xl border-primary/10 font-black text-[11px] uppercase gap-3 bg-white shadow-sm hover:bg-primary/5 transition-all">
                <CalendarIcon className="w-4 h-4 text-primary" />
                {format(date, "PPPP", { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-[2rem] border-primary/10 shadow-2xl" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                locale={es}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="relative group">
        <div className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-2xl bg-primary/5 flex items-center justify-center group-focus-within:bg-primary transition-all">
          <Search className="w-5 h-5 text-primary group-focus-within:text-white" />
        </div>
        <Input 
          placeholder="AGREGAR CLIENTE AL LOTE..." 
          className="pl-20 h-20 rounded-[2.5rem] border-2 border-primary/10 font-black text-sm uppercase tracking-wide bg-white shadow-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
          value={customerSearch}
          onChange={e => setCustomerSearch(e.target.value)}
          onFocus={() => setIsSearchOpen(true)}
        />
        
        {isSearchOpen && (
          <div className="absolute z-50 w-full mt-4 bg-white border-2 border-primary/10 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="p-4 bg-primary/5 border-b border-primary/5 flex justify-between items-center">
              <span className="text-[10px] font-black uppercase text-primary tracking-widest ml-4">Clientes Recientes</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setIsSearchOpen(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="max-h-[300px] overflow-y-auto scrollbar-hide">
              {filteredSearchCustomers.length > 0 ? filteredSearchCustomers.map(c => (
                <button 
                  key={c.id} 
                  className="w-full text-left px-8 py-5 hover:bg-primary/5 border-b border-primary/5 last:border-0 flex items-center justify-between group transition-all"
                  onClick={() => handleAddCustomer(c)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                      <User className="w-5 h-5 text-primary group-hover:text-white" />
                    </div>
                    <div>
                      <div className="font-black text-[13px] text-foreground uppercase tracking-tight">{c.name}</div>
                      <div className="text-[9px] font-black text-primary/40 uppercase tracking-widest">{c.id}</div>
                    </div>
                  </div>
                  <Plus className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-all mr-2" />
                </button>
              )) : (
                <div className="p-10 text-center text-[10px] font-black uppercase text-primary/20 tracking-widest">Sin resultados</div>
              )}
            </div>
          </div>
        )}
      </div>

      <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden">
        <div className="bg-primary/5 border-b border-primary/5 py-5 px-10 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <PackageCheck className="w-5 h-5 text-primary" />
            <span className="text-[12px] font-black uppercase text-primary tracking-widest">Lote de Envío #{dateKey}</span>
          </div>
          <Badge className="bg-primary text-white px-5 py-1.5 rounded-full font-black text-[10px] shadow-lg shadow-primary/20">
            {logEntries.length} CLIENTES EN LISTA
          </Badge>
        </div>
        <CardContent className="p-0">
          {logEntries.length === 0 ? (
            <div className="p-24 flex flex-col items-center justify-center text-center space-y-4 opacity-20">
              <Truck className="w-20 h-20" />
              <div className="font-black text-sm uppercase tracking-[0.2em]">Lote Vacío</div>
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {logEntries.map((entry: any, index: number) => {
                const totalAmount = entry.quotes.reduce((acc: number, q: any) => acc + (q.selected ? q.amount : 0), 0)
                const totalQty = entry.quotes.reduce((acc: number, q: any) => acc + (q.selected ? q.quantity : 0), 0)
                const hasNewQuotes = activeQuotes.some(q => q.customerId === entry.customerId && q.status === "active" && !entry.quotes.some((eq: any) => eq.quoteId === q.id))

                return (
                  <AccordionItem key={entry.customerId} value={entry.customerId} className="border-b last:border-0 border-primary/5 px-4 md:px-8">
                    <div className="flex items-center gap-4">
                      <span className="w-8 h-8 rounded-full bg-primary/5 text-primary flex items-center justify-center font-black text-[12px] shrink-0">{index + 1}</span>
                      <AccordionTrigger className="flex-1 hover:no-underline py-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between w-full text-left gap-4 md:pr-10">
                          <div className="flex items-center gap-3">
                            <span className="font-black text-[15px] text-foreground uppercase tracking-tight">{entry.customerName}</span>
                            <span className="text-[9px] font-black text-primary/40 uppercase bg-primary/5 px-2 py-0.5 rounded-md">{entry.customerId}</span>
                          </div>
                          <div className="flex items-center gap-8">
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest leading-none mb-1">Total Lote</span>
                              <span className="font-headline font-black text-xl text-foreground">S/ {totalAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest leading-none mb-1">Prendas</span>
                              <span className="font-headline font-black text-xl text-primary">{totalQty}</span>
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 rounded-2xl text-primary/20 hover:text-destructive hover:bg-destructive/5"
                        onClick={() => setDeleteConfirm({ id: entry.customerId, name: entry.customerName })}
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>

                    <AccordionContent className="pb-8 pt-2 pl-12">
                      <div className="space-y-4">
                        {hasNewQuotes && (
                          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between shadow-sm animate-pulse">
                            <div className="flex items-center gap-3">
                              <AlertCircle className="w-5 h-5 text-amber-600" />
                              <span className="text-[11px] font-black text-amber-800 uppercase tracking-wide">¿Agregar Cotización Reciente?</span>
                            </div>
                            <Button className="h-8 bg-amber-600 text-white rounded-xl text-[9px] font-black uppercase px-6" onClick={() => handleAddCustomer({ id: entry.customerId, name: entry.customerName })}>Actualizar</Button>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-1 gap-3">
                          {entry.quotes.map((q: any) => (
                            <div key={q.quoteId} className={cn(
                              "flex items-center justify-between p-5 rounded-3xl border transition-all",
                              q.selected ? "bg-primary/[0.02] border-primary/10 shadow-sm" : "bg-secondary/20 border-transparent opacity-50"
                            )}>
                              <div className="flex items-center gap-6">
                                <Checkbox 
                                  checked={q.selected} 
                                  onCheckedChange={() => handleToggleQuote(entry.customerId, q.quoteId)}
                                  className="h-6 w-6 rounded-lg border-2" 
                                />
                                <div className="flex flex-col">
                                  <span className="font-black text-[13px] text-foreground tracking-tight">{q.quoteId}</span>
                                  <span className="text-[9px] font-medium text-muted-foreground uppercase">Despacho</span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-12">
                                <div className="text-right">
                                  <div className="text-[8px] font-black text-primary/40 uppercase mb-0.5">Monto</div>
                                  <div className="font-headline font-black text-[16px]">S/ {Number(q.amount).toFixed(2)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[8px] font-black text-primary/40 uppercase mb-0.5">Und</div>
                                  <div className="font-headline font-black text-[16px]">{q.quantity}</div>
                                </div>
                                
                                <div className={cn(
                                  "min-w-[120px] text-center px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-colors",
                                  q.selected 
                                    ? "bg-green-50 text-green-600 border-green-200" 
                                    : "bg-red-50 text-red-600 border-red-200"
                                )}>
                                  {q.selected ? "ENVIADO" : "NO ENVIADO"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="rounded-[3rem] border-none shadow-2xl max-w-sm overflow-hidden p-0">
          <div className="bg-destructive/10 p-10 flex flex-col items-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-xl">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <div className="space-y-2">
              <h3 className="text-[12px] font-black uppercase text-destructive tracking-[0.2em]">¿Eliminar del Lote?</h3>
              <p className="text-[14px] font-black text-foreground/80 uppercase leading-snug">Se quitará a <span className="text-destructive">{deleteConfirm?.name}</span> de la lista.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full">
              <Button variant="outline" className="h-14 rounded-2xl font-black text-[10px] uppercase border-destructive/20 text-destructive hover:bg-destructive/5" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
              <Button className="h-14 rounded-2xl font-black text-[10px] uppercase bg-destructive text-white shadow-lg shadow-destructive/20 hover:opacity-90" onClick={handleDeleteEntry}>Confirmar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
