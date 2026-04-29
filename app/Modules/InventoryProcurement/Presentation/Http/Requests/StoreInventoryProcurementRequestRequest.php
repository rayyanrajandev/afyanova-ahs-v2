<?php

namespace App\Modules\InventoryProcurement\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreInventoryProcurementRequestRequest extends FormRequest
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
            'itemId' => ['nullable', 'uuid'],
            'itemName' => ['nullable', 'string', 'max:180', 'required_without:itemId'],
            'category' => ['nullable', 'string', 'max:120'],
            'unit' => ['nullable', 'string', 'max:40', 'required_without:itemId'],
            'reorderLevel' => ['nullable', 'numeric', 'min:0'],
            'requestedQuantity' => ['required', 'numeric', 'gt:0'],
            'unitCostEstimate' => ['nullable', 'numeric', 'min:0'],
            'neededBy' => ['nullable', 'date'],
            'supplierId' => ['nullable', 'uuid'],
            'supplierName' => ['nullable', 'string', 'max:180'],
            'sourceDepartmentRequisitionId' => ['nullable', 'uuid', 'exists:inventory_department_requisitions,id'],
            'sourceDepartmentRequisitionLineId' => ['nullable', 'uuid', 'exists:inventory_department_requisition_lines,id'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
