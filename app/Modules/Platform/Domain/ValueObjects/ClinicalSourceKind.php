<?php

namespace App\Modules\Platform\Domain\ValueObjects;

use App\Modules\Laboratory\Infrastructure\Models\LaboratoryOrderModel;
use App\Modules\Pharmacy\Infrastructure\Models\PharmacyOrderModel;
use App\Modules\Radiology\Infrastructure\Models\RadiologyOrderModel;
use App\Modules\ClinicalProcedure\Infrastructure\Models\ClinicalProcedureOrderModel;
use App\Modules\TheatreProcedure\Infrastructure\Models\TheatreProcedureModel;

enum ClinicalSourceKind: string
{
    case LABORATORY_ORDER = 'laboratory_order';
    case PHARMACY_ORDER = 'pharmacy_order';
    case RADIOLOGY_ORDER = 'radiology_order';
    case CLINICAL_PROCEDURE_ORDER = 'clinical_procedure_order';
    case THEATRE_PROCEDURE = 'theatre_procedure';
    case APPOINTMENT_CONSULTATION = 'appointment_consultation';

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $kind): string => $kind->value, self::cases());
    }

    /**
     * Resolve from a source workflow kind string, supporting legacy POS names.
     */
    public static function fromWorkflowKind(string $kind): ?self
    {
        return match ($kind) {
            'laboratory_order' => self::LABORATORY_ORDER,
            'pharmacy_order', 'pharmacy_prescription' => self::PHARMACY_ORDER,
            'radiology_order' => self::RADIOLOGY_ORDER,
            'clinical_procedure_order' => self::CLINICAL_PROCEDURE_ORDER,
            'theatre_procedure', 'procedure' => self::THEATRE_PROCEDURE,
            'appointment_consultation' => self::APPOINTMENT_CONSULTATION,
            default => null,
        };
    }

    /**
     * @return array<int, self>
     */
    public static function orderKinds(): array
    {
        return [self::LABORATORY_ORDER, self::PHARMACY_ORDER, self::RADIOLOGY_ORDER, self::CLINICAL_PROCEDURE_ORDER, self::THEATRE_PROCEDURE];
    }

    public function modelClass(): string
    {
        return match ($this) {
            self::LABORATORY_ORDER => LaboratoryOrderModel::class,
            self::PHARMACY_ORDER => PharmacyOrderModel::class,
            self::RADIOLOGY_ORDER => RadiologyOrderModel::class,
            self::CLINICAL_PROCEDURE_ORDER => ClinicalProcedureOrderModel::class,
            self::THEATRE_PROCEDURE => TheatreProcedureModel::class,
            self::APPOINTMENT_CONSULTATION => throw new \LogicException('Consultations are not order-shaped.'),
        };
    }

    public function catalogFk(): string
    {
        return match ($this) {
            self::LABORATORY_ORDER => 'lab_test_catalog_item_id',
            self::PHARMACY_ORDER => 'approved_medicine_catalog_item_id',
            self::RADIOLOGY_ORDER => 'radiology_procedure_catalog_item_id',
            self::CLINICAL_PROCEDURE_ORDER => 'clinical_procedure_catalog_item_id',
            self::THEATRE_PROCEDURE => 'theatre_procedure_catalog_item_id',
            self::APPOINTMENT_CONSULTATION => throw new \LogicException('Consultations have no catalog FK.'),
        };
    }

    /**
     * @return array<int, string>
     */
    public function posStatuses(): array
    {
        return match ($this) {
            self::LABORATORY_ORDER => ['ordered'],
            self::PHARMACY_ORDER => ['pending'],
            self::RADIOLOGY_ORDER => ['ordered'],
            self::CLINICAL_PROCEDURE_ORDER => ['ordered'],
            self::THEATRE_PROCEDURE => ['planned'],
            self::APPOINTMENT_CONSULTATION => throw new \LogicException('Consultations are not POS-eligible.'),
        };
    }

    public function posEntryState(): ?string
    {
        return match ($this) {
            self::PHARMACY_ORDER => 'active',
            default => null,
        };
    }

    public function posExcludeEnteredInError(): bool
    {
        return match ($this) {
            self::LABORATORY_ORDER, self::PHARMACY_ORDER, self::RADIOLOGY_ORDER, self::CLINICAL_PROCEDURE_ORDER => true,
            self::THEATRE_PROCEDURE => false,
            self::APPOINTMENT_CONSULTATION => throw new \LogicException('Consultations are not POS-eligible.'),
        };
    }
}
