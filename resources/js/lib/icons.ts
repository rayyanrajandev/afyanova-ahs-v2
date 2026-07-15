import {
    ActivityIcon,
    Add01Icon,
    Alert01Icon,
    ArrowLeft01Icon,
    ArrowRight01Icon,
    BedDoubleIcon,
    Building01Icon,
    BookOpen01Icon,
    Calendar01Icon,
    CancelCircleIcon,
    CheckListIcon,
    Download01Icon,
    CheckmarkCircle01Icon,
    EyeIcon,
    File02Icon,
    Folder01Icon,
    Invoice01Icon,
    LayoutGridIcon,
    ListViewIcon,
    Loading03Icon,
    Login01Icon,
    Mail01Icon,
    MapPinIcon,
    MoreVerticalIcon,
    PackageIcon,
    Pen01Icon,
    PillIcon,
    PrinterIcon,
    ScissorIcon,
    SecurityCheckIcon,
    SlidersHorizontalIcon,
    SpoonAndForkIcon,
    StethoscopeIcon,
    TestTube01Icon,
    TimeScheduleIcon,
    UserGroupIcon,
    UserIcon,
    UserRemove01Icon,
    ViewOffIcon,
} from '@hugeicons/core-free-icons';
import type { IconArray } from '@hugeicons/vue';
import {
    Activity,
    AlertCircle,
    Archive,
    AlertTriangle,
    ArrowRight,
    ArrowUpDown,
    ArrowUpRight,
    Bell,
    Banknote,
    BedDouble,
    Building2,
    BookOpen,
    Calendar,
    CalendarClock,
    Check,
    ChartBarBig,
    Clock,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronsUpDown,
    CircleCheck,
    CircleX,
    ClipboardList,
    EllipsisVertical,
    Eye,
    EyeOff,
    FileText,
    FlaskConical,
    Folder,
    HeartPulse,
    LayoutGrid,
    Download,
    Info,
    Layers,
    LayoutList,
    List,
    Loader2,
    Lock,
    LogIn,
    Mail,
    MapPin,
    Package,
    PackageCheck,
    PanelRightOpen,
    Phone,
    Printer,
    Pill,
    Plus,
    Receipt,
    RefreshCw,
    RotateCcw,
    Scale,
    Scissors,
    Search,
    ShieldCheck,
    ShoppingCart,
    SlidersHorizontal,
    SquarePen,
    Stethoscope,
    Star,
    Truck,
    Tag,
    Trash2,
    Undo2,
    User,
    UserPlus,
    UserX,
    Users,
    UtensilsCrossed,
    Warehouse,
    X,
} from 'lucide-vue-next';
import type { Component } from 'vue';
import type { IconPack } from '@/types';

export type AppIconName =
    | 'activity'
    | 'alert-circle'
    | 'archive'
    | 'bell'
    | 'alert-triangle'
    | 'arrow-right'
    | 'arrow-up-down'
    | 'arrow-up-right'
    | 'banknote'
    | 'bed-double'
    | 'book-open'
    | 'building-2'
    | 'calendar'
    | 'calendar-plus-2'
    | 'calendar-clock'
    | 'chart-bar-big'
    | 'check'
    | 'check-circle'
    | 'clock'
    | 'chevron-down'
    | 'chevron-left'
    | 'chevron-right'
    | 'chevron-up'
    | 'chevrons-up-down'
    | 'circle-check-big'
    | 'circle-x'
    | 'clipboard-list'
    | 'download'
    | 'ellipsis-vertical'
    | 'eye'
    | 'eye-off'
    | 'file-text'
    | 'flask-conical'
    | 'folder'
    | 'heart-pulse'
    | 'info'
    | 'layout-grid'
    | 'layout-list'
    | 'layers'
    | 'list'
    | 'list-restart'
    | 'loader-circle'
    | 'lock'
    | 'log-in'
    | 'mail'
    | 'map-pin'
    | 'package'
    | 'package-check'
    | 'panel-right-open'
    | 'pencil'
    | 'phone'
    | 'pill'
    | 'plus'
    | 'printer'
    | 'receipt'
    | 'refresh-cw'
    | 'rotate-ccw'
    | 'scale'
    | 'scissors'
    | 'search'
    | 'shield-check'
    | 'shopping-cart'
    | 'sliders-horizontal'
    | 'stethoscope'
    | 'star'
    | 'tag'
    | 'trash-2'
    | 'truck'
    | 'undo-2'
    | 'utensils-crossed'
    | 'warehouse'
    | 'user'
    | 'user-plus'
    | 'user-x'
    | 'users'
    | 'x';

const LUCIDE_ICON_MAP: Record<AppIconName, Component> = {
    activity: Activity,
    'alert-circle': AlertCircle,
    archive: Archive,
    bell: Bell,
    'alert-triangle': AlertTriangle,
    'arrow-right': ArrowRight,
    'arrow-up-down': ArrowUpDown,
    'arrow-up-right': ArrowUpRight,
    banknote: Banknote,
    'bed-double': BedDouble,
    'book-open': BookOpen,
    'building-2': Building2,
    calendar: Calendar,
    'calendar-plus-2': Calendar,
    'calendar-clock': CalendarClock,
    'chart-bar-big': ChartBarBig,
    check: Check,
    'check-circle': CircleCheck,
    clock: Clock,
    'chevron-down': ChevronDown,
    'chevron-left': ChevronLeft,
    'chevron-right': ChevronRight,
    'chevron-up': ChevronUp,
    'chevrons-up-down': ChevronsUpDown,
    'circle-check-big': CircleCheck,
    'circle-x': CircleX,
    'clipboard-list': ClipboardList,
    download: Download,
    'ellipsis-vertical': EllipsisVertical,
    eye: Eye,
    'eye-off': EyeOff,
    'file-text': FileText,
    'flask-conical': FlaskConical,
    folder: Folder,
    'heart-pulse': HeartPulse,
    info: Info,
    'layout-grid': LayoutGrid,
    'layout-list': LayoutList,
    layers: Layers,
    list: List,
    'list-restart': ClipboardList,
    'loader-circle': Loader2,
    lock: Lock,
    'log-in': LogIn,
    mail: Mail,
    'map-pin': MapPin,
    package: Package,
    'package-check': PackageCheck,
    'panel-right-open': PanelRightOpen,
    pencil: SquarePen,
    phone: Phone,
    pill: Pill,
    plus: Plus,
    printer: Printer,
    receipt: Receipt,
    'refresh-cw': RefreshCw,
    'rotate-ccw': RotateCcw,
    scale: Scale,
    scissors: Scissors,
    search: Search,
    'shield-check': ShieldCheck,
    'shopping-cart': ShoppingCart,
    'sliders-horizontal': SlidersHorizontal,
    stethoscope: Stethoscope,
    star: Star,
    tag: Tag,
    'trash-2': Trash2,
    truck: Truck,
    'undo-2': Undo2,
    'utensils-crossed': UtensilsCrossed,
    warehouse: Warehouse,
    user: User,
    'user-plus': UserPlus,
    'user-x': UserX,
    users: Users,
    x: X,
};

const HUGE_ICON_MAP = {
    activity: ActivityIcon,
    'alert-circle': Alert01Icon,
    archive: Folder01Icon,
    'alert-triangle': Alert01Icon,
    'arrow-right': ArrowRight01Icon,
    'arrow-up-down': SlidersHorizontalIcon,
    'arrow-up-right': ArrowRight01Icon,
    banknote: Invoice01Icon,
    'bed-double': BedDoubleIcon,
    'book-open': BookOpen01Icon,
    'building-2': Building01Icon,
    calendar: Calendar01Icon,
    'calendar-plus-2': Calendar01Icon,
    'calendar-clock': TimeScheduleIcon,
    'chart-bar-big': LayoutGridIcon,
    check: CheckmarkCircle01Icon,
    'check-circle': CheckmarkCircle01Icon,
    clock: TimeScheduleIcon,
    'chevron-down': ArrowRight01Icon,
    'chevron-left': ArrowLeft01Icon,
    'chevron-right': ArrowRight01Icon,
    'chevron-up': ArrowLeft01Icon,
    'chevrons-up-down': SlidersHorizontalIcon,
    'circle-check-big': CheckmarkCircle01Icon,
    'circle-x': CancelCircleIcon,
    'clipboard-list': CheckListIcon,
    download: Download01Icon,
    'ellipsis-vertical': MoreVerticalIcon,
    eye: EyeIcon,
    'eye-off': ViewOffIcon,
    'file-text': File02Icon,
    'flask-conical': TestTube01Icon,
    folder: Folder01Icon,
    'heart-pulse': ActivityIcon,
    info: Alert01Icon,
    'layout-grid': LayoutGridIcon,
    'layout-list': ListViewIcon,
    layers: LayoutGridIcon,
    list: ListViewIcon,
    'list-restart': CheckListIcon,
    'loader-circle': Loading03Icon,
    lock: SecurityCheckIcon,
    'log-in': Login01Icon,
    mail: Mail01Icon,
    'map-pin': MapPinIcon,
    package: PackageIcon,
    'package-check': CheckmarkCircle01Icon,
    'panel-right-open': EyeIcon,
    pencil: Pen01Icon,
    phone: UserIcon,
    pill: PillIcon,
    plus: Add01Icon,
    printer: PrinterIcon,
    receipt: Invoice01Icon,
    'refresh-cw': ActivityIcon,
    'rotate-ccw': ArrowLeft01Icon,
    scale: SlidersHorizontalIcon,
    scissors: ScissorIcon,
    search: ListViewIcon,
    'shield-check': SecurityCheckIcon,
    'shopping-cart': Invoice01Icon,
    'sliders-horizontal': SlidersHorizontalIcon,
    stethoscope: StethoscopeIcon,
    star: CheckmarkCircle01Icon,
    tag: Invoice01Icon,
    'trash-2': CancelCircleIcon,
    truck: PackageIcon,
    'undo-2': ArrowLeft01Icon,
    'utensils-crossed': SpoonAndForkIcon,
    warehouse: Building01Icon,
    user: UserIcon,
    'user-plus': UserIcon,
    'user-x': UserRemove01Icon,
    users: UserGroupIcon,
    x: CancelCircleIcon,
} as Record<AppIconName, IconArray>;

export function resolveAppIcon(
    name: AppIconName | null | undefined,
    pack: IconPack = 'lucide',
): Component | null {
    if (!name) {
        return null;
    }

    if (pack === 'huge') {
        return LUCIDE_ICON_MAP[name] ?? null;
    }

    return LUCIDE_ICON_MAP[name] ?? null;
}

export function resolveHugeIcon(
    name: AppIconName | null | undefined,
): IconArray | null {
    if (!name) {
        return null;
    }

    return HUGE_ICON_MAP[name] ?? null;
}
