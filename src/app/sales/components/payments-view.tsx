
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
  CreditCard,
  Loader2,
  Trash2,
  Filter,
  Edit2,
  X,
  Check,
  MoreVertical
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useFirestore, useDoc, useCollection } from "@/firebase"
import { 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  limit, 
  deleteDoc, 
  updateDoc,
  setDoc
} from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

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
  
  const [editingPayment, setEditingPayment] = React.useState<any>(null)
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null)

  const dateKey = format(date, "yyyy-MM-dd")
  const dayLockRef = React.useMemo(() => db ? doc(db, "dayLocks", dateKey) : null, [db, dateKey])
  const { data: dayLock } = useDoc(dayLockRef)
  const isDayClosed = !!dayLock?.isLocked

  // Protección contra pérdida de datos
  React.useEffect(() => {
    const hasUnsavedChanges = amount !== "" || selectedCustomer !== null;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !saving) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [amount, selectedCustomer, saving]);

  const customersRef = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("name")) : null, [db])
  const { data: dbCustomers = [] } = useCollection(customersRef)

  const dayLocksRef = React.useMemo(() => db ? collection(db, "dayLocks") : null, [db])
  const { data: allDayLocks = [] } = useCollection(dayLocksRef)

  const paymentsQuery = React.useMemo(() => {
    if (!db) return null
    return query(collection(db, "payments"), orderBy("date", "desc"), limit(200))
  }, [db])
  const { data: payments = [], loading } = useCollection(paymentsQuery)

  React.useEffect(() => {
    if (!editingPayment) {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.date) setDate(new Date(parsed.date))
          if (parsed.amount) setAmount(parsed.amount)
        } catch (e) {}
      }
    }
  }, [editingPayment])

  React.useEffect(() => {
    if (!editingPayment) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        date: date.toISOString(),
        amount
      }))
    }
  }, [date, amount, editingPayment])

  React.useEffect(() => {
    if (banks.length > 0 && !selectedBank) {
      const dbDefault = banks.find((b: any) => b.isDefault);
      setSelectedBank(dbDefault || banks[0])
    }
  }, [banks, selectedBank])

  const handleReset = () => {
    if (amount !== "" || selectedCustomer !== null) {
      if (!confirm("¿DESCARTAR DATOS DEL PAGO ACTUAL?")) return;
    }
    setEditingPayment(null)
    setDate(new Date())
    setAmount("")
    setSelectedCustomer(null)
    setCustomerSearch("")
    localStorage.removeItem(STORAGE_KEY)
    const dbDefault = banks.find((b: any) => b.isDefault);
    setSelectedBank(dbDefault || (banks.length > 0 ? banks[0] : null))
  }

  const handleSavePayment = () => {
    if (!db || !selectedCustomer || !amount || !selectedBank) {
      toast({ variant: "destructive", title: "DATOS INCOMPLETOS" })
      return
    }

    if (isDayClosed && !editingPayment) {
      toast({ variant: "destructive", title: "FECHA BLOQUEADA" })
      return
    }

    setSaving(true)
    
    const paymentData = {
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      amount: Number(amount),
      bankId: selectedBank.id,
      bankName: selectedBank.name,
      date: format(date, "yyyy-MM-dd"),
      isLocked: editingPayment ? editingPayment.isLocked : false,
      updatedAt: serverTimestamp(),
      ...(editingPayment ? {} : { createdAt: serverTimestamp() })
    }

    const docRef = editingPayment 
      ? doc(db, "payments", editingPayment.id)
      : collection(db, "payments")

    const action = editingPayment 
      ? updateDoc(docRef as any, paymentData)
      : addDoc(docRef as any, paymentData)

    action.then(() => {
        setEditingPayment(null)
        setDate(new Date())
        setAmount("")
        setSelectedCustomer(null)
        setCustomerSearch("")
        localStorage.removeItem(STORAGE_KEY)
        setSaving(false)
        toast({ title: editingPayment ? "PAGO ACTUALIZADO" : "PAGO REGISTRADO" })
      })
      .catch(async (err) => {
        setSaving(false)
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: editingPayment ? `payments/${editingPayment.id}` : 'payments',
          operation: editingPayment ? 'update' : 'create',
          requestResourceData: paymentData
        }));
      });
  }

  const togglePaymentLock = (payment: any) => {
    if (!db) return
    const pRef = doc(db, "payments", payment.id)
    updateDoc(pRef, { isLocked: !payment.isLocked, updatedAt: serverTimestamp() }).catch(() => {})
  }

  const toggleDayLock = (currentDateKey: string, allPaymentsInDay: any[], isCurrentLocked: boolean) => {
    if (!db) return
    
    if (!isCurrentLocked) {
      const allLocked = allPaymentsInDay.length > 0 && allPaymentsInDay.every(p => p.isLocked)
      if (!allLocked) {
        toast({ variant: "destructive", title: "BLOQUEADO", description: "Cierre los candados individuales primero." })
        return
      }
    }

    const lockRef = doc(db, "dayLocks", currentDateKey)
    setDoc(lockRef, {
      date: currentDateKey,
      isLocked: !isCurrentLocked,
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(() => {})
    
    toast({ title: isCurrentLocked ? "DÍA ABIERTO" : "DÍA CERRADO" })
  }

  const startEditing = (p: any) => {
    if (p.isLocked) return
    setEditingPayment(p)
    setDate(new Date(p.date + "T12:00:00"))
    setAmount(p.amount.toString())
    setSelectedCustomer({ id: p.customerId, name: p.customerName })
    setSelectedBank(banks.find((b: any) => b.id === p.bankId) || { id: p.bankId, name: p.bankName })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = (pId: string) => {
    if (!db) return
    const pRef = doc(db, "payments", pId)
    deleteDoc(pRef).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: pRef.path, operation: 'delete' }));
    })
    setDeleteConfirmId(null)
    toast({ title: "Pago eliminado" })
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
    const groups: Record<string, { label: string, dateKey: string, total: number, isDayLocked: boolean, payments: any[], bankGroups: any[] }> = {}
    
    filteredPayments.forEach(p => {
      const label = format(new Date(p.date + "T12:00:00"), "EEEE d 'de' MMMM", { locale: es }).toUpperCase()
      const isLocked = allDayLocks.find(l => l.date === p.date)?.isLocked || false
      
      if (!groups[label]) groups[label] = { label, dateKey: p.date, total: 0, isDayLocked: isLocked, payments: [], bankGroups: [] }
      groups[label].payments.push(p)
      groups[label].total += p.amount
    })

    const finalGroups = Object.values(groups).sort((a, b) => b.dateKey.localeCompare(a.dateKey))

    if (isBankGrouped) {
      finalGroups.forEach(g => {
        const bankMap: Record<string, { bankName: string, total: number, count: number, records: any[] }> = {}
        g.payments.forEach(p => {
          if (!bankMap[p.bankName]) bankMap[p.bankName] = { bankName: p.bankName, total: 0, count: 0, records: [] }
          bankMap[p.bankName].total += p.amount
          bankMap[p.bankName].count += 1
          bankMap[p.bankName].records.push(p)
        })
        g.bankGroups = Object.values(bankMap).sort((a, b) => b.total - a.total)
      })
    }

    return finalGroups
  }, [filteredPayments, isBankGrouped, allDayLocks])

  return (
    <div className="space-y-6 px-2 md:px-0 pb-24">
      {/* Registro de Pago */}
      <Card className={cn(
        "rounded-[2.5rem] border-2 bg-white shadow-2xl relative transition-all overflow-hidden",
        isDayClosed && !editingPayment ? "border-red-500 bg-red-50" : "border-primary/20"
      )}>
        <div className="bg-primary/5 p-4 border-b border-primary/10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h2 className="text-[12px] font-black uppercase text-primary tracking-widest">
              {editingPayment ? "EDITAR COBRO" : "REGISTRAR COBRO"}
            </h2>
          </div>
          {isDayClosed && !editingPayment && (
            <Badge variant="destructive" className="font-black text-[10px] uppercase">Día Bloqueado</Badge>
          )}
          <Button variant="ghost" size="icon" className="h-9 w-9 text-primary/40 hover:text-primary transition-all" onClick={handleReset}>
            <RotateCcw className="w-5 h-5" />
          </Button>
        </div>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">FECHA</Label>
              <input 
                type="date"
                value={format(date, "yyyy-MM-dd")}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) setDate(new Date(val + "T12:00:00"));
                }}
                className="w-full h-11 px-3 rounded-xl border border-primary/10 font-black text-xs uppercase bg-white focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">MONTO S/</Label>
              <Input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                className="h-11 text-sm font-black border-primary/10 rounded-xl bg-green-50 text-green-700"
                placeholder="0.0"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">BANCO RECEPTOR</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {banks.map((bank: any) => (
                <Button
                  key={bank.id}
                  variant={selectedBank?.id === bank.id ? "default" : "outline"}
                  className={cn(
                    "h-11 rounded-xl font-black text-[10px] uppercase border-primary/10 transition-all",
                    selectedBank?.id === bank.id ? "bg-primary text-white" : "bg-white"
                  )}
                  onClick={() => setSelectedBank(bank)}
                >
                  {bank.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1 relative">
              <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">CLIENTE</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-primary/30" />
                <Input 
                  placeholder="NOMBRE O ID..." 
                  className={cn("h-11 pl-9 text-xs font-black uppercase rounded-xl border-primary/10 bg-white", editingPayment && "bg-secondary/20")}
                  value={selectedCustomer ? `${selectedCustomer.name} [${selectedCustomer.id}]` : customerSearch}
                  onChange={e => { if (!editingPayment) { if (selectedCustomer) setSelectedCustomer(null); setCustomerSearch(e.target.value); } }}
                  readOnly={!!editingPayment}
                />
                {filteredCustomers.length > 0 && !editingPayment && (
                  <div className="absolute z-[9999] w-full mt-2 bg-white border-2 border-primary/10 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                    {filteredCustomers.map(c => (
                      <button key={c.id} className="w-full text-left px-4 py-4 hover:bg-primary/5 border-b last:border-0 font-black text-[10px] uppercase" onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }}>
                        {c.name} <span className="text-primary ml-1">[{c.id}]</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Button 
              className={cn("h-11 w-11 rounded-xl text-white shadow-lg shrink-0", editingPayment ? "bg-orange-500" : "bg-primary")}
              onClick={handleSavePayment}
              disabled={saving || !amount || !selectedCustomer || !selectedBank || (isDayClosed && !editingPayment)}
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : editingPayment ? <Check className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Listado y Filtros */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3 h-4 w-4 text-primary/30" />
            <Input placeholder="FILTRAR COBROS..." className="h-10 pl-10 rounded-xl border-primary/10 font-black text-[10px] uppercase bg-white" value={listFilter} onChange={e => setListFilter(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 bg-white px-3 h-10 rounded-xl border border-primary/10">
            <Filter className={cn("w-3.5 h-3.5", isBankGrouped ? "text-orange-500" : "text-muted-foreground")} />
            <Switch checked={isBankGrouped} onCheckedChange={setIsBankGrouped} />
          </div>
        </div>

        {loading && (
          <div className="py-20 text-center opacity-30"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>
        )}

        {groupedPayments.map(group => (
          <div key={group.dateKey} className={cn("space-y-2 rounded-2xl p-1 transition-colors", group.isDayLocked && "bg-red-50/50")}>
            <div className={cn("flex justify-between items-center px-4 py-2 rounded-xl border", group.isDayLocked ? "bg-red-100 border-red-200" : "bg-primary/5 border-primary/10")}>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => toggleDayLock(group.dateKey, group.payments, group.isDayLocked)}
                  className={cn("transition-all", group.isDayLocked ? "text-red-600" : "text-muted-foreground/30 hover:text-primary")}
                >
                  {group.isDayLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
                <span className={cn("text-[10px] font-black uppercase tracking-widest", group.isDayLocked ? "text-red-700" : "text-primary")}>{group.label}</span>
              </div>
              <span className={cn("font-headline font-black text-sm", group.isDayLocked && "text-red-700")}>S/ {group.total.toFixed(1)}</span>
            </div>

            <div className="space-y-1.5 px-1">
              {isBankGrouped ? group.bankGroups.map((bg, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between px-6 py-0.5 bg-orange-50/50 rounded-lg border-l-4 border-orange-400">
                    <span className="text-[9px] font-black text-orange-600 uppercase">{bg.bankName}</span>
                    <span className="text-[10px] font-black text-orange-700">S/ {bg.total.toFixed(1)}</span>
                  </div>
                  {bg.records.map(p => <PaymentRecord key={p.id} p={p} onEdit={startEditing} onDelete={handleDelete} onLock={togglePaymentLock} deleteConfirmId={deleteConfirmId} setDeleteConfirmId={setDeleteConfirmId} />)}
                </div>
              )) : group.payments.map(p => <PaymentRecord key={p.id} p={p} onEdit={startEditing} onDelete={handleDelete} onLock={togglePaymentLock} deleteConfirmId={deleteConfirmId} setDeleteConfirmId={setDeleteConfirmId} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PaymentRecord({ p, onEdit, onDelete, onLock, deleteConfirmId, setDeleteConfirmId }: any) {
  return (
    <Card className={cn("rounded-xl border border-primary/5 bg-white shadow-sm transition-all", p.isLocked && "bg-slate-50/50")}>
      <CardContent className="p-2 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button 
            onClick={() => onLock(p)}
            className={cn("p-2 rounded-lg transition-all", p.isLocked ? "text-primary bg-primary/10" : "text-muted-foreground/20 hover:text-primary")}
          >
            {p.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-black text-[11px] text-foreground uppercase truncate">{p.customerName}</span>
              <span className="text-[8px] font-black text-primary/40 uppercase">[{p.customerId}]</span>
            </div>
            <div className="text-[9px] font-medium text-muted-foreground uppercase">{p.bankName}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="font-headline font-black text-[15px] text-foreground">S/ {Number(p.amount).toFixed(1)}</div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button disabled={p.isLocked} className="p-2 text-primary/30 hover:text-primary disabled:opacity-10"><MoreVertical className="w-4 h-4" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl p-1.5 w-32 shadow-xl border-primary/10">
              <DropdownMenuItem className="text-[10px] font-black uppercase gap-2.5 p-2.5" onClick={() => onEdit(p)}>
                <Edit2 className="w-3.5 h-3.5 text-primary" /> Editar
              </DropdownMenuItem>
              
              <Popover open={deleteConfirmId === p.id} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <PopoverTrigger asChild>
                  <button className="w-full text-left flex items-center gap-2.5 px-2.5 py-2.5 text-[10px] font-black uppercase text-destructive hover:bg-destructive/5 rounded-md" onClick={() => setDeleteConfirmId(p.id)}>
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2 rounded-xl border-none shadow-xl bg-black text-white" side="top">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[8px] font-black uppercase">¿ELIMINAR PAGO?</span>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 px-3 text-[9px] font-black bg-white text-black hover:bg-white/90" onClick={() => onDelete(p.id)}>SÍ</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-3 text-[9px] font-black text-white hover:bg-white/10" onClick={() => setDeleteConfirmId(null)}>NO</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}
