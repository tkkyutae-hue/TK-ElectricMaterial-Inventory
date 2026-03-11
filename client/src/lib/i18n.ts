export type Lang = "en" | "ko" | "es";

export const LANGUAGES: { code: Lang; label: string; flag: string; country: string }[] = [
  { code: "en", label: "English",  flag: "🇺🇸", country: "US" },
  { code: "ko", label: "한국어",    flag: "🇰🇷", country: "KR" },
  { code: "es", label: "Español",  flag: "🇲🇽", country: "MX" },
];

export type Translations = typeof en;

const en = {
  // ── Auth ─────────────────────────────────────────────────────────────────
  signIn:             "Sign In",
  email:              "Email",
  password:           "Password",
  signingIn:          "Signing in…",
  invalidCredentials: "Invalid email or password.",
  loginError:         "Login failed. Please try again.",

  // ── Home / Mode select ───────────────────────────────────────────────────
  morning:            "Morning",
  afternoon:          "Afternoon",
  evening:            "Evening",
  goodMorning:        "Good morning,",
  goodAfternoon:      "Good afternoon,",
  goodEvening:        "Good evening,",
  selectMode:         "Select a mode to continue.",
  fieldMode:          "Field Mode",
  adminMode:          "Admin Mode",
  logout:             "Logout",
  roleNote:           "— Contact an admin for elevated access.",
  role:               "Role",

  // Mode-card tags
  tagReceive:         "Receive",
  tagIssue:           "Issue",
  tagInventory:       "Inventory",
  tagTransfer:        "Transfer",
  tagDashboard:       "Dashboard",
  tagReports:         "Reports",
  tagSuppliers:       "Suppliers",
  tagUsers:           "Users",

  // ── Field layout header ──────────────────────────────────────────────────
  fieldModeChip:      "Field Mode",
  back:               "Back",
  modeSelect:         "Mode Select",

  // ── Field home ───────────────────────────────────────────────────────────
  fieldActions:       "Field Actions",
  whatToDo:           "What do you need\nto do?",
  selectAction:       "Select an action to continue.",

  // Field home cards
  receiveReturn:      "Receive / Return",
  issueTransfer:      "Issue / Transfer",
  inventoryCard:      "Inventory",
  transactionsCard:   "Transactions",
  draftMovements:     "Draft Movements",

  tagReceiveUpper:    "RECEIVE",
  tagReturnUpper:     "RETURN",
  tagIssueUpper:      "ISSUE",
  tagTransferUpper:   "TRANSFER",
  tagBrowse:          "BROWSE",
  tagSearch:          "SEARCH",
  tagHistory:         "HISTORY",
  tagFilter:          "FILTER",
  tagSaved:           "SAVED",
  tagPending:         "PENDING",

  // ── Admin sidebar nav ────────────────────────────────────────────────────
  navMain:            "Main",
  navOperations:      "Operations",
  navInsights:        "Insights",
  navAdminTools:      "Admin Tools",

  navDashboard:       "Dashboard",
  navInventory:       "Inventory",
  navTransactions:    "Transactions",
  navSuppliers:       "Suppliers",
  navProjects:        "Projects",
  navReorder:         "Reorder",
  navReports:         "Reports",
  navUserApprovals:   "User Approvals",
  navExportBackup:    "Export Backup",
  backToHome:         "Back to Home",
  signOut:            "Sign Out",
  adminModeChip:      "Admin Mode",
};

const ko: Translations = {
  signIn:             "로그인",
  email:              "이메일",
  password:           "비밀번호",
  signingIn:          "로그인 중…",
  invalidCredentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
  loginError:         "로그인에 실패했습니다. 다시 시도해 주세요.",

  morning:            "아침",
  afternoon:          "오후",
  evening:            "저녁",
  goodMorning:        "좋은 아침이에요,",
  goodAfternoon:      "좋은 오후에요,",
  goodEvening:        "좋은 저녁이에요,",
  selectMode:         "모드를 선택하세요.",
  fieldMode:          "현장 모드",
  adminMode:          "관리자 모드",
  logout:             "로그아웃",
  roleNote:           "— 더 높은 권한은 관리자에게 문의하세요.",
  role:               "역할",

  tagReceive:         "입고",
  tagIssue:           "출고",
  tagInventory:       "재고",
  tagTransfer:        "이송",
  tagDashboard:       "대시보드",
  tagReports:         "보고서",
  tagSuppliers:       "공급업체",
  tagUsers:           "사용자",

  fieldModeChip:      "현장 모드",
  back:               "뒤로",
  modeSelect:         "모드 선택",

  fieldActions:       "현장 작업",
  whatToDo:           "무엇을\n해야 하나요?",
  selectAction:       "계속하려면 작업을 선택하세요.",

  receiveReturn:      "입고 / 반품",
  issueTransfer:      "출고 / 이송",
  inventoryCard:      "재고",
  transactionsCard:   "거래 내역",
  draftMovements:     "임시 저장",

  tagReceiveUpper:    "입고",
  tagReturnUpper:     "반품",
  tagIssueUpper:      "출고",
  tagTransferUpper:   "이송",
  tagBrowse:          "탐색",
  tagSearch:          "검색",
  tagHistory:         "내역",
  tagFilter:          "필터",
  tagSaved:           "저장됨",
  tagPending:         "대기 중",

  navMain:            "메인",
  navOperations:      "운영",
  navInsights:        "인사이트",
  navAdminTools:      "관리 도구",

  navDashboard:       "대시보드",
  navInventory:       "재고 관리",
  navTransactions:    "거래 내역",
  navSuppliers:       "공급업체",
  navProjects:        "프로젝트",
  navReorder:         "재주문",
  navReports:         "보고서",
  navUserApprovals:   "사용자 승인",
  navExportBackup:    "백업 내보내기",
  backToHome:         "홈으로",
  signOut:            "로그아웃",
  adminModeChip:      "관리자 모드",
};

const es: Translations = {
  signIn:             "Iniciar sesión",
  email:              "Correo electrónico",
  password:           "Contraseña",
  signingIn:          "Iniciando sesión…",
  invalidCredentials: "Correo o contraseña incorrectos.",
  loginError:         "Error al iniciar sesión. Inténtalo de nuevo.",

  morning:            "Mañana",
  afternoon:          "Tarde",
  evening:            "Noche",
  goodMorning:        "Buenos días,",
  goodAfternoon:      "Buenas tardes,",
  goodEvening:        "Buenas noches,",
  selectMode:         "Selecciona un modo para continuar.",
  fieldMode:          "Modo Campo",
  adminMode:          "Modo Admin",
  logout:             "Salir",
  roleNote:           "— Contacta a un admin para mayor acceso.",
  role:               "Rol",

  tagReceive:         "Recibir",
  tagIssue:           "Enviar",
  tagInventory:       "Inventario",
  tagTransfer:        "Transferir",
  tagDashboard:       "Panel",
  tagReports:         "Informes",
  tagSuppliers:       "Proveedores",
  tagUsers:           "Usuarios",

  fieldModeChip:      "Modo Campo",
  back:               "Atrás",
  modeSelect:         "Selección de modo",

  fieldActions:       "Acciones de campo",
  whatToDo:           "¿Qué necesitas\nhacer?",
  selectAction:       "Selecciona una acción para continuar.",

  receiveReturn:      "Recibir / Devolver",
  issueTransfer:      "Enviar / Transferir",
  inventoryCard:      "Inventario",
  transactionsCard:   "Transacciones",
  draftMovements:     "Borradores",

  tagReceiveUpper:    "RECIBIR",
  tagReturnUpper:     "DEVOLVER",
  tagIssueUpper:      "ENVIAR",
  tagTransferUpper:   "TRANSFERIR",
  tagBrowse:          "EXPLORAR",
  tagSearch:          "BUSCAR",
  tagHistory:         "HISTORIAL",
  tagFilter:          "FILTRAR",
  tagSaved:           "GUARDADOS",
  tagPending:         "PENDIENTES",

  navMain:            "Principal",
  navOperations:      "Operaciones",
  navInsights:        "Perspectivas",
  navAdminTools:      "Herramientas admin",

  navDashboard:       "Panel",
  navInventory:       "Inventario",
  navTransactions:    "Transacciones",
  navSuppliers:       "Proveedores",
  navProjects:        "Proyectos",
  navReorder:         "Reordenar",
  navReports:         "Informes",
  navUserApprovals:   "Aprobaciones",
  navExportBackup:    "Exportar copia",
  backToHome:         "Ir al inicio",
  signOut:            "Cerrar sesión",
  adminModeChip:      "Modo Admin",
};

export const TRANSLATIONS: Record<Lang, Translations> = { en, ko, es };
