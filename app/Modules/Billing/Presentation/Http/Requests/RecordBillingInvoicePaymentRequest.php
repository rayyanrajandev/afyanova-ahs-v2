<?php

namespace App\Modules\Billing\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RecordBillingInvoicePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'gt:0'],
            'payerType' => ['required', 'string', Rule::in([
                'self_pay',
                'insurance',
                'employer',
                'government',
                'donor',
                'other',
            ])],
            'paymentMethod' => ['required', 'string', Rule::in([
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
            'note' => ['nullable', 'string', 'max:255'],
            'paymentAt' => ['nullable', 'date'],
        ];
    }
}

