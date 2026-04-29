<?php

namespace App\Modules\Billing\Presentation\Http\Requests;

use App\Modules\Billing\Domain\ValueObjects\BillingInvoiceStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateBillingInvoiceStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if ($user === null) {
            return false;
        }

        $status = trim(strtolower((string) $this->input('status')));

        if ($status === BillingInvoiceStatus::ISSUED->value) {
            return $user->can('billing.invoices.issue');
        }

        if ($status === BillingInvoiceStatus::VOIDED->value) {
            return $user->can('billing.invoices.void');
        }

        if ($status === BillingInvoiceStatus::CANCELLED->value) {
            return $user->can('billing.invoices.cancel');
        }

        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(BillingInvoiceStatus::values())],
            'reason' => ['nullable', 'string', 'max:255', 'required_if:status,cancelled,voided'],
            'paidAmount' => ['nullable', 'numeric', 'min:0'],
            'paymentPayerType' => ['nullable', 'string', Rule::in([
                'self_pay',
                'insurance',
                'employer',
                'government',
                'donor',
                'other',
            ])],
            'paymentMethod' => ['nullable', 'string', Rule::in([
                'cash',
                'mobile_money',
                'card',
                'bank_transfer',
                'insurance_claim',
                'cheque',
                'waiver',
                'other',
            ])],
            'paymentReference' => ['nullable', 'string', 'max:120'],
        ];
    }
}
