import { AccountForm, CheckpointForm } from '../forms/AccountForms'
import { HoldingForm, OpForm } from '../forms/InvestForms'
import { RecurringForm, ValidateForm } from '../forms/RecurringForms'
import { SplitForm } from '../forms/SplitForm'
import { TxForm } from '../forms/TxForm'
import { AssetForm, EmployeeForm, LiabilityForm } from '../forms/WealthForms'
import { useUI, type ModalSpec } from '../lib/ui'

function render(m: ModalSpec, onClose: () => void) {
  switch (m.type) {
    case 'tx':
      return <TxForm onClose={onClose} tx={m.tx} kind={m.kind} accountId={m.accountId} scope={m.scope} preset={m.preset} />
    case 'split':
      return <SplitForm onClose={onClose} accountId={m.accountId} />
    case 'account':
      return <AccountForm onClose={onClose} id={m.id} preset={m.preset} />
    case 'checkpoint':
      return <CheckpointForm onClose={onClose} accountId={m.accountId} month={m.month} txId={m.txId} />
    case 'recurring':
      return <RecurringForm onClose={onClose} id={m.id} preset={m.preset} />
    case 'validate':
      return <ValidateForm onClose={onClose} recurringId={m.recurringId} month={m.month} />
    case 'holding':
      return <HoldingForm onClose={onClose} id={m.id} accountId={m.accountId} />
    case 'op':
      return <OpForm onClose={onClose} holdingId={m.holdingId} id={m.id} kind={m.kind} />
    case 'asset':
      return <AssetForm onClose={onClose} id={m.id} preset={m.preset} />
    case 'liability':
      return <LiabilityForm onClose={onClose} id={m.id} />
    case 'employee':
      return <EmployeeForm onClose={onClose} id={m.id} />
  }
}

export function ModalHost() {
  const modals = useUI((s) => s.modals)
  const closeTop = useUI((s) => s.closeTop)
  if (!modals.length) return null
  const top = modals[modals.length - 1]
  return <div key={modals.length}>{render(top, closeTop)}</div>
}
