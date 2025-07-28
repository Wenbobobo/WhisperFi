const knex = require("knex");
const path = require("path");

/**
 * 数据库配置
 */
const dbConfig = {
  client: "sqlite3",
  connection: {
    filename: path.join(__dirname, "db.sqlite"),
  },
  useNullAsDefault: true,
};

// 创建 Knex 实例
const db = knex(dbConfig);

/**
 * 初始化数据库，创建必要的表结构
 * @returns {Promise<void>}
 */
async function setupDatabase() {
  try {
    // 检查 intents 表是否存在，如果不存在则创建
    const hasIntentsTable = await db.schema.hasTable("intents");

    if (!hasIntentsTable) {
      await db.schema.createTable("intents", (table) => {
        table.string("id").primary(); // UUID 作为主键
        table.string("status").notNullable().defaultTo("pending"); // 状态字段
        table.text("intent_data").notNullable(); // JSON 字符串存储意图数据
        table.string("tx_hash").nullable(); // 交易哈希
        table.integer("retry_count").defaultTo(0); // 重试次数
        table.datetime("created_at").defaultTo(db.fn.now()); // 创建时间
        table.datetime("updated_at").defaultTo(db.fn.now()); // 更新时间
      });

      console.log("✅ 数据库初始化完成：intents 表已创建");
    } else {
      // 检查是否需要添加新字段（向后兼容）
      const hasRetryCount = await db.schema.hasColumn("intents", "retry_count");
      const hasTxHash = await db.schema.hasColumn("intents", "tx_hash");
      const hasUpdatedAt = await db.schema.hasColumn("intents", "updated_at");

      if (!hasRetryCount || !hasTxHash || !hasUpdatedAt) {
        await db.schema.alterTable("intents", (table) => {
          if (!hasTxHash) table.string("tx_hash").nullable();
          if (!hasRetryCount) table.integer("retry_count").defaultTo(0);
          if (!hasUpdatedAt)
            table.datetime("updated_at").defaultTo(db.fn.now());
        });
        console.log("✅ 数据库表结构已更新");
      }

      console.log("ℹ️  数据库已存在：intents 表已就绪");
    }
  } catch (error) {
    console.error("❌ 数据库初始化失败:", error);
    throw error;
  }
}

/**
 * 创建新的交易意图记录
 * @param {string} intentId - 意图唯一标识符
 * @param {Object} intentData - 意图数据对象
 * @returns {Promise<void>}
 */
async function createIntent(intentId, intentData) {
  try {
    await db("intents").insert({
      id: intentId,
      status: "pending",
      intent_data: JSON.stringify(intentData),
      retry_count: 0,
    });
  } catch (error) {
    console.error(`❌ 创建意图失败 (ID: ${intentId}):`, error);
    throw error;
  }
}

/**
 * 根据 ID 查询意图状态
 * @param {string} intentId - 意图唯一标识符
 * @returns {Promise<Object|null>} 意图记录或 null
 */
async function getIntentById(intentId) {
  try {
    const intent = await db("intents").where("id", intentId).first();

    if (intent) {
      return {
        id: intent.id,
        status: intent.status,
        intent_data: JSON.parse(intent.intent_data),
        tx_hash: intent.tx_hash,
        retry_count: intent.retry_count || 0,
        created_at: intent.created_at,
        updated_at: intent.updated_at,
      };
    }

    return null;
  } catch (error) {
    console.error(`❌ 查询意图失败 (ID: ${intentId}):`, error);
    throw error;
  }
}

/**
 * 获取所有待处理的意图
 * @returns {Promise<Array>} 待处理的意图列表
 */
async function getPendingIntents() {
  try {
    const intents = await db("intents")
      .where("status", "pending")
      .orderBy("created_at", "asc");

    return intents.map((intent) => ({
      id: intent.id,
      status: intent.status,
      intent_data: JSON.parse(intent.intent_data),
      tx_hash: intent.tx_hash,
      retry_count: intent.retry_count || 0,
      created_at: intent.created_at,
      updated_at: intent.updated_at,
    }));
  } catch (error) {
    console.error("❌ 获取待处理意图失败:", error);
    throw error;
  }
}

/**
 * 更新意图状态
 * @param {string} intentId - 意图唯一标识符
 * @param {string} newStatus - 新状态 ('pending', 'submitted', 'confirmed', 'failed')
 * @returns {Promise<void>}
 */
async function updateIntentStatus(intentId, newStatus) {
  try {
    await db("intents").where("id", intentId).update({
      status: newStatus,
      updated_at: db.fn.now(),
    });
  } catch (error) {
    console.error(`❌ 更新意图状态失败 (ID: ${intentId}):`, error);
    throw error;
  }
}

/**
 * 更新意图状态并记录交易哈希
 * @param {string} intentId - 意图唯一标识符
 * @param {string} newStatus - 新状态
 * @param {string} txHash - 交易哈希（可选）
 * @returns {Promise<void>}
 */
async function updateIntentWithTxHash(intentId, newStatus, txHash = null) {
  try {
    const updateData = {
      status: newStatus,
      updated_at: db.fn.now(),
    };
    if (txHash) {
      updateData.tx_hash = txHash;
    }

    await db("intents").where("id", intentId).update(updateData);
  } catch (error) {
    console.error(`❌ 更新意图状态和交易哈希失败 (ID: ${intentId}):`, error);
    throw error;
  }
}

/**
 * 增加意图重试次数
 * @param {string} intentId - 意图唯一标识符
 * @returns {Promise<void>}
 */
async function incrementRetryCount(intentId) {
  try {
    await db("intents")
      .where("id", intentId)
      .increment("retry_count", 1)
      .update("updated_at", db.fn.now());
  } catch (error) {
    console.error(`❌ 增加重试次数失败 (ID: ${intentId}):`, error);
    throw error;
  }
}

/**
 * 清理所有意图数据（仅用于测试）
 * @returns {Promise<void>}
 */
async function clearAllIntents() {
  try {
    await db("intents").del();
    console.log("🧹 测试数据库已清理");
  } catch (error) {
    console.error("❌ 清理数据库失败:", error);
    throw error;
  }
}

/**
 * 生成唯一的意图 ID (简单的 UUID 实现)
 * @returns {string} 唯一标识符
 */
function generateIntentId() {
  return "intent_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

module.exports = {
  setupDatabase,
  createIntent,
  getIntentById,
  getPendingIntents,
  updateIntentStatus,
  updateIntentWithTxHash,
  incrementRetryCount,
  generateIntentId,
  clearAllIntents,
};
