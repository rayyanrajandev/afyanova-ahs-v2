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
    CheckmarkCircle01Icon,
    EyeIcon,
    File02Icon,
    Folder01Icon,
    Invoice01Icon,
    LayoutGridIcon,
    ListViewIcon,
    Login01Icon,
    Mail01Icon,
    MapPinIcon,
    MoreVerticalIcon,
    PackageIcon,
    Pen01Icon,
    PillIcon,
    ScissorIcon,
    SecurityCheckIcon,
    SlidersHorizontalIcon,
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
    AlertTriangle,
    ArrowRight,
    ArrowUpRight,
    BedDouble,
    Building2,
    BookOpen,
    Calendar,
    CalendarClock,
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
    LayoutList,
    LogIn,
    Mail,
    MapPin,
    Package,
    PanelRightOpen,
    Phone,
    Pill,
    Plus,
    Receipt,
    RefreshCw,
    RotateCcw,
    Scissors,
    Search,
    ShieldCheck,
    SlidersHorizontal,
    SquarePen,
    Stethoscope,
    Undo2,
    User,
    UserX,
    Users,
    X,
} from 'lucide-vue-next';
import type { Component } from 'vue';
import type { IconPack } from '@/types';

export type AppIconName =
    | 'activity'
    | 'alert-triangle'
    | 'arrow-right'
    | 'arrow-up-right'
    | 'bed-double'
    | 'book-open'
    | 'building-2'
    | 'calendar'
    | 'calendar-plus-2'
    | 'calendar-clock'
    | 'check-circle'
    | 'chevron-down'
    | 'chevron-left'
    | 'chevron-right'
    | 'chevron-up'
    | 'chevrons-up-down'
    | 'circle-check-big'
    | 'circle-x'
    | 'clipboard-list'
    | 'ellipsis-vertical'
    | 'eye'
    | 'eye-off'
    | 'file-text'
    | 'flask-conical'
    | 'folder'
    | 'heart-pulse'
    | 'layout-grid'
    | 'layout-list'
    | 'list-restart'
    | 'log-in'
    | 'mail'
    | 'map-pin'
    | 'package'
    | 'panel-right-open'
    | 'pencil'
    | 'phone'
    | 'pill'
    | 'plus'
    | 'receipt'
    | 'refresh-cw'
    | 'rotate-ccw'
    | 'scissors'
    | 'search'
    | 'shield-check'
    | 'sliders-horizontal'
    | 'stethoscope'
    | 'undo-2'
    | 'user'
    | 'user-x'
    | 'users'
    | 'x';

const LUCIDE_ICON_MAP: Record<AppIconName, Component> = {
    activity: Activity,
    'alert-triangle': AlertTriangle,
    'arrow-right': ArrowRight,
    'arrow-up-right': ArrowUpRight,
    'bed-double': BedDouble,
    'book-open': BookOpen,
    'building-2': Building2,
    calendar: Calendar,
    'calendar-plus-2': Calendar,
    'calendar-clock': CalendarClock,
    'check-circle': CircleCheck,
    'chevron-down': ChevronDown,
    'chevron-left': ChevronLeft,
    'chevron-right': ChevronRight,
    'chevron-up': ChevronUp,
    'chevrons-up-down': ChevronsUpDown,
    'circle-check-big': CircleCheck,
    'circle-x': CircleX,
    'clipboard-list': ClipboardList,
    'ellipsis-vertical': EllipsisVertical,
    eye: Eye,
    'eye-off': EyeOff,
    'file-text': FileText,
    'flask-conical': FlaskConical,
    folder: Folder,
    'heart-pulse': HeartPulse,
    'layout-grid': LayoutGrid,
    'layout-list': LayoutList,
    'list-restart': ClipboardList,
    'log-in': LogIn,
    mail: Mail,
    'map-pin': MapPin,
    package: Package,
    'panel-right-open': PanelRightOpen,
    pencil: SquarePen,
    phone: Phone,
    pill: Pill,
    plus: Plus,
    receipt: Receipt,
    'refresh-cw': RefreshCw,
    'rotate-ccw': RotateCcw,
    scissors: Scissors,
    search: Search,
    'shield-check': ShieldCheck,
    'sliders-horizontal': SlidersHorizontal,
    stethoscope: Stethoscope,
    'undo-2': Undo2,
    user: User,
    'user-x': UserX,
    users: Users,
    x: X,
};

const HUGE_ICON_MAP = {
    activity: ActivityIcon,
    'alert-triangle': Alert01Icon,
    'arrow-right': ArrowRight01Icon,
    'arrow-up-right': ArrowRight01Icon,
    'bed-double': BedDoubleIcon,
    'book-open': BookOpen01Icon,
    'building-2': Building01Icon,
    calendar: Calendar01Icon,
    'calendar-plus-2': Calendar01Icon,
    'calendar-clock': TimeScheduleIcon,
    'check-circle': CheckmarkCircle01Icon,
    'chevron-down': ArrowRight01Icon,
    'chevron-left': ArrowLeft01Icon,
    'chevron-right': ArrowRight01Icon,
    'chevron-up': ArrowLeft01Icon,
    'chevrons-up-down': SlidersHorizontalIcon,
    'circle-check-big': CheckmarkCircle01Icon,
    'circle-x': CancelCircleIcon,
    'clipboard-list': CheckListIcon,
    'ellipsis-vertical': MoreVerticalIcon,
    eye: EyeIcon,
    'eye-off': ViewOffIcon,
    'file-text': File02Icon,
    'flask-conical': TestTube01Icon,
    folder: Folder01Icon,
    'heart-pulse': ActivityIcon,
    'layout-grid': LayoutGridIcon,
    'layout-list': ListViewIcon,
    'list-restart': CheckListIcon,
    'log-in': Login01Icon,
    mail: Mail01Icon,
    'map-pin': MapPinIcon,
    package: PackageIcon,
    'panel-right-open': EyeIcon,
    pencil: Pen01Icon,
    phone: UserIcon,
    pill: PillIcon,
    plus: Add01Icon,
    receipt: Invoice01Icon,
    'refresh-cw': ActivityIcon,
    'rotate-ccw': ArrowLeft01Icon,
    scissors: ScissorIcon,
    search: ListViewIcon,
    'shield-check': SecurityCheckIcon,
    'sliders-horizontal': SlidersHorizontalIcon,
    stethoscope: StethoscopeIcon,
    'undo-2': ArrowLeft01Icon,
    user: UserIcon,
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
