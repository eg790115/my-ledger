export const APP_VERSION = "2026.03.18.AI語音記帳PRO";
export const DB_NAME = "FamilyAccountingDB";
export const STORE_NAME = "transactions";
export const DB_VERSION = 1;

export const LS = {
  pending: "pending_sync_v23",
  txCache: "local_tx_cache_v23",
  trashCache: "local_trash_cache_v23",
  lastSync: "last_sync_time_v23",
  members: "family_member_config_v23",
  deviceToken: "device_token_v1",
  deviceExp: "device_exp_v1",
  pinHashPrefix: "pin_hash_v23_",
  bioCredPrefix: "bio_cred_",
  bioFailPrefix: "bio_fail_v1_",
  bioLockPrefix: "bio_lock_v1_",
  greetingsCache: "greetings_cache_v1",
  ackProxyTxs: "ack_proxy_txs_v1",
  billingStartDay: "billing_start_day_v1"
};

export const CATEGORY_MAP = {
  expense: {
    "食": ["早餐", "午餐", "晚餐", "生鮮食材", "零食/飲料", "外食聚餐", "其他"],
    "衣": ["爸爸服飾", "媽媽服飾", "小孩服飾", "鞋包/配件", "保養/美妝", "其他"],
    "居家": ["房貸", "管理費", "水費", "電費", "瓦斯費", "網路/電信", "家具/家電", "日用品", "房屋稅/地價稅", "其他"],
    "行": ["大眾運輸", "計程車/共享", "加油", "停車費", "保養維修", "牌照/燃料稅", "eTag/過路費", "其他"],
    "教育": ["學校學費", "安親/才藝班", "教材/文具", "童書/玩具", "零用錢", "其他"],
    "娛樂": ["國內旅遊", "國外旅遊", "串流訂閱", "運動健身", "聚會活動", "電影/展覽", "其他"],
    "醫療": ["保健食品", "診所門診", "牙醫/眼科", "醫美", "住院", "其他"],
    "理財": ["股票/ETF", "定期定額", "基金", "儲蓄險", "外匯", "加密貨幣", "其他"],
    "其他": ["保險費", "孝親費", "紅白包", "捐款/贈與", "雜項"]
  },
  income: { "收入": ["爸爸薪資", "媽媽薪資", "獎金", "投資收益", "利息", "其他收入"] }
};

export const BEN_OPTIONS = ["爸爸", "媽媽", "兒子", "其他"];

export const CHART_COLORS = { 
  expense: ["#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#06b6d4", "#3b82f6", "#6366f1", "#ec4899", "#f43f5e", "#ef4444"], 
  income: ["#10b981", "#059669", "#047857", "#3b82f6", "#2563eb", "#1d4ed8", "#0ea5e9", "#0891b2"], 
  beneficiary: ["#ef4444", "#dc2626", "#b91c1c", "#f87171", "#fca5a5", "#991b1b", "#7f1d1d", "#ea580c"] 
};