<?php

namespace App\Modules\Billing\Application\Exceptions;

use InvalidArgumentException;

class InvalidBillingServiceCatalogClinicalLinkException extends InvalidArgumentException
{
    public function field(): string
    {
        return 'clinicalCatalogItemId';
    }
}
