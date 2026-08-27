
"use client"

import * as React from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { 
  Plus, 
  Search, 
  Lock, 
  Unlock, 
  RotateCcw, 
  Calendar as CalendarIcon, 
  CreditCard,
  Loader2,
  Trash2,
  Filter
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Switch } from "@/components/ui/switch"
import { useFirestore, useDoc, useCollection } from "@/firebase"
import { collection, query, orderBy, addDoc, serverTimestamp, doc, limit, deleteDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "stilo_payment_draft"

export default function PaymentsView() {
  const db = useFirestore()
  const { toast } = useToast()
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  
  const banks = React.useMemo(() => config?.banks || [], [config])

  const [saving, setSaving] = React.useState(false)
  const [date, setDate] = React.useState<Date>(new Date())
  const [amount, setAmount] = React.useState("")
  const [selectedBank, setSelectedBank] = React.useState<any>(null)
  const [selectedCustomer, setSelectedCustomer] = React.useState<any>(null)
  const [customerSearch, setCustomerSearch] = React.useState("")
  const [listFilter, setListFilter] = React.useState("")
  const [isBankGrouped, setIsBankGrouped] = React.useState(false)

  const customersRef = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("name")) : null, [db])
  const { data: dbCustomers = [] } = useCollection(customersRef)

  const paymentsQuery = React.useMemo(() => {
    if (!db) return null
    return query(collection(db, "payments"), orderBy("createdAt", "desc"), limit(100))
  }, [db])
  const { data: payments = [], loading } = useCollection(paymentsQuery)

  // Persistencia de borrador
  React.useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.date) setDate(new Date(parsed.date))
        if (parsed.amount) setAmount(parsed.amount)
        if (parsed.selectedBank) setSelectedBank(parsed.selectedBank)
        if (parsed.selectedCustomer) setSelectedCustomer(parsed.selectedCustomer)
      } catch (e) {}
    }
  }, [])

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: date.toISOString(),
      amount,
      selectedBank,
      selectedCustomer
    }))
  }, [date, amount, selectedBank, selectedCustomer])

  // Selección automática de banco por defecto desde Firestore
  React.useEffect(() => {
    if (banks.length > 0 && !selectedBank) {
      const dbDefault = banks.find((b: any) => b.isDefault);
      setSelectedBank(dbDefault || banks[0])
    }
  }, [banks, selectedBank])

  const handleReset = () => {
    setDate(new Date())
    setAmount("")
    setSelectedCustomer(null)
    setCustomerSearch("")
    localStorage.removeItem(STORAGE_KEY)
    const dbDefault = banks.find((b: any) => b.isDefault);
    setSelectedBank(dbDefault || (banks.length > 0 ? banks[0] : null))
    toast({ title: "Formulario Reiniciado" })
  }

  const handleAddPayment = async () => {
    if (!db || !selectedCustomer || !amount || !selectedBank) {
      toast({ variant: "destructive", title: "DATOS INCOMPLETOS" })
      return
    }
    setSaving(true)
    try {
      await addDoc(collection(db, "payments"), {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        amount: Number(amount),
        bankId: selectedBank.id,
        bankName: selectedBank.name,
        date: format(date, "yyyy-MM-dd"),
        isLocked: false,
        createdAt: serverTimestamp()
      })
      setAmount("")
      toast({ title: "PAGO REGISTRADO EN DB" })
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR DE CONEXIÓN" })
    } finally {
      setSaving(false)
    }
  }

  const filteredCustomers = React.useMemo(() => {
    if (customerSearch.length < 1) return []
    const q = customerSearch.toLowerCase()
    return dbCustomers.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
  }, [customerSearch, dbCustomers])

  const filteredPayments = React.useMemo(() => {
    const q = listFilter.toLowerCase()
    return payments.filter(p => 
      p.customerName.toLowerCase().includes(q) || 
      p.customerId.toLowerCase().includes(q)
    )
  }, [payments, listFilter])

  const groupedPayments = React.useMemo(() => {
    const groups: Record<string, { label: string, total: number, payments: any[], bankSummaries: any[] }> = {}
    filteredPayments.forEach(p => {
      const pDate = new Date(p.date + "T12:00:00")
      const label = format(pDate, "EEEE d 'de' MMMM", { locale: es }).toUpperCase()
      if (!groups[label]) groups[label] = { label, total: 0, payments: [], bankSummaries: [] }
      groups[label].payments.push(p)
      groups[label].total += p.amount
    })
    
    if (isBankGrouped) {
      Object.keys(groups).forEach(label => {
        const bankMap: Record<string, { bankName: string, total: number, count: number }> = {}
        groups[label].payments.forEach(p => {
          if (!bankMap[p.bankName]) bankMap[p.bankName] = { bankName: p.bankName, total: 0, count: 0 }
          bankMap[p.bankName].total += p.amount
          bankMap[p.bankName].count += 1
        })
        groups[label].bankSummaries = Object.values(bankMap)
      })
    }
    
    return Object.values(groups)
  }, [filteredPayments, isBankGrouped])

  return (
    <div className="space-y-6 px-2 md:px-0 pb-24">
      {/* Plantilla de Registro - FIJA Y VISIBLE */}
      <Card className="rounded-[2.5rem] border-2 border-primary/20 bg-white shadow-2xl overflow-visible relative">
        <div className="bg-primary/5 p-5 border-b border-primary/10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h2 className="text-[12px] font-black uppercase text-primary tracking-widest">Registrar Cobranza</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-primary/40 hover:text-primary active:rotate-90 transition-all" onClick={handleReset}>
            <RotateCcw className="w-5 h-5" />
          </Button>
        </div>
        <CardContent className="p-6 space-y-6 overflow-visible">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Fecha de Pago</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-12 rounded-xl border-primary/10 justify-start font-black text-xs uppercase bg-white">
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {format(date, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl z-[200]" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus locale={es} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Monto S/</Label>
              <Input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                className="h-12 text-sm font-black border-primary/10 rounded-xl bg-green-50 text-green-700"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Seleccionar Banco</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {banks.length === 0 ? (
                <div className="col-span-full py-4 text-center text-[9px] font-black uppercase text-muted-foreground opacity-30 border-2 border-dashed rounded-xl">Configure bancos en Ajustes</div>
              ) : banks.map((bank: any) => (
                <Button
                  key={bank.id}
                  variant={selectedBank?.id === bank.id ? "default" : "outline"}
                  className={cn(
                    "h-12 rounded-xl font-black text-[10px] uppercase border-primary/10 transition-all",
                    selectedBank?.id === bank.id ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]" : "bg-white text-muted-foreground"
                  )}
                  onClick={() => setSelectedBank(bank)}
                >
                  {bank.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 items-end overflow-visible">
            <div className="flex-1 space-y-1 relative">
              <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-primary/30" />
                <Input 
                  placeholder="BUSCAR CLIENTE..." 
                  className="h-12 pl-9 text-xs font-black uppercase rounded-xl border-primary/10 bg-white"
                  value={selectedCustomer ? `${selectedCustomer.name} [${selectedCustomer.id}]` : customerSearch}
                  onChange={e => { if (selectedCustomer) setSelectedCustomer(null); setCustomerSearch(e.target.value); }}
                />
                {filteredCustomers.length > 0 && (
                  <div className="absolute z-[999] w-full mt-2 bg-white border-2 border-primary/10 rounded-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden max-h-48 overflow-y-auto">
                    {filteredCustomers.map(c => (
                      <button 
                        key={c.id} 
                        className="w-full text-left px-4 py-4 hover:bg-primary/5 border-b last:border-0 font-black text-[10px] uppercase text-foreground transition-colors"
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }}
                      >
                        {c.name} <span className="text-primary ml-1">[{c.id}]</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Button 
              className="h-12 w-12 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 active:scale-95 transition-all shrink-0"
              onClick={handleAddPayment}
              disabled={saving || !amount || !selectedCustomer || !selectedBank}
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Pagos */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3 h-4 w-4 text-primary/30" />
            <Input 
              placeholder="FILTRAR POR CLIENTE..." 
              className="h-10 pl-10 rounded-xl border-primary/10 font-black text-[10px] uppercase bg-white shadow-sm"
              value={listFilter}
              onChange={e => setListFilter(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 bg-white px-3 h-10 rounded-xl border border-primary/10 shadow-sm">
            <Filter className={cn("w-3.5 h-3.5", isBankGrouped ? "text-orange-500" : "text-muted-foreground")} />
            <Switch 
              checked={isBankGrouped} 
              onCheckedChange={setIsBankGrouped} 
              className="data-[state=checked]:bg-orange-500 data-[state=unchecked]:bg-slate-200"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-20 text-center opacity-30"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />Cargando cobros...</div>
        ) : groupedPayments.length === 0 ? (
          <div className="p-20 text-center opacity-20 font-black text-[10px] uppercase border-2 border-dashed rounded-[2rem]">Sin cobros registrados</div>
        ) : groupedPayments.map(group => (
          <div key={group.label} className="space-y-2">
            <div className="flex justify-between items-center px-4">
              <span className="text-[9px] font-black uppercase text-primary tracking-widest">{group.label}</span>
              <div className="flex items-center gap-3">
                <Lock className="w-3.5 h-3.5 text-primary/30" />
                <span className="font-headline font-black text-sm text-foreground">S/ {group.total.toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              {isBankGrouped ? group.bankSummaries.map((s, idx) => (
                <Card key={idx} className="rounded-xl border border-orange-200 bg-orange-50/30 shadow-sm overflow-hidden">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-black text-[12px] text-orange-600 uppercase">{s.bankName}</div>
                      <div className="text-[8px] font-black text-orange-400 uppercase tracking-widest">{s.count} PAGOS REGISTRADOS</div>
                    </div>
                    <div className="font-headline font-black text-lg text-orange-700">S/ {s.total.toFixed(2)}</div>
                  </CardContent>
                </Card>
              )) : group.payments.map(p => (
                <Card key={p.id} className="rounded-xl border border-primary/5 bg-white shadow-sm overflow-hidden group">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-[11px] text-foreground uppercase truncate">{p.customerName}</span>
                        <span className="text-[8px] font-black text-primary/40 uppercase">[{p.customerId}]</span>
                      </div>
                      <div className="text-[9px] font-medium text-muted-foreground uppercase mt-0.5">{p.bankName}</div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div className="font-headline font-black text-[15px] text-foreground">S/ {p.amount.toFixed(2)}</div>
                      <div className="flex items-center gap-2">
                        <Unlock className="w-4 h-4 text-green-500/40" />
                        <button 
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-destructive rounded-lg transition-all"
                          onClick={() => { if(confirm("¿ELIMINAR PAGO?")) deleteDoc(doc(db, "payments", p.id)); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
