import os

directories = [
    r'C:\Portfolio\afyanova-ahs-v2\app\Modules\ServiceRequest\Domain\ValueObjects',
    r'C:\Portfolio\afyanova-ahs-v2\app\Modules\ServiceRequest\Domain\Repositories',
    r'C:\Portfolio\afyanova-ahs-v2\app\Modules\ServiceRequest\Domain\Services',
    r'C:\Portfolio\afyanova-ahs-v2\app\Modules\ServiceRequest\Infrastructure\Models',
    r'C:\Portfolio\afyanova-ahs-v2\app\Modules\ServiceRequest\Infrastructure\Services',
    r'C:\Portfolio\afyanova-ahs-v2\app\Modules\ServiceRequest\Infrastructure\Repositories',
    r'C:\Portfolio\afyanova-ahs-v2\app\Modules\ServiceRequest\Application\Exceptions',
    r'C:\Portfolio\afyanova-ahs-v2\app\Modules\ServiceRequest\Application\UseCases',
    r'C:\Portfolio\afyanova-ahs-v2\app\Modules\ServiceRequest\Presentation\Http\Controllers',
    r'C:\Portfolio\afyanova-ahs-v2\app\Modules\ServiceRequest\Presentation\Http\Requests',
    r'C:\Portfolio\afyanova-ahs-v2\app\Modules\ServiceRequest\Presentation\Http\Transformers',
]

for directory in directories:
    os.makedirs(directory, exist_ok=True)
    print(f'Created: {directory}')

print('All directories created successfully!')
