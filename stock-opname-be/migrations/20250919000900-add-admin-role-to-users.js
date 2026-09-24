'use strict';

module.exports = {
  async up(queryInterface) {
    // Postgres requires ALTER TYPE for enums; can't add an enum value through addColumn/changeColumn.
    await queryInterface.sequelize.query('ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS \'admin\'');
  },

  async down() {
    // Postgres has no "remove enum value" - a downgrade would require rebuilding the type and
    // rewriting every row, which isn't worth it for a value with no other side effects.
    throw new Error('Irreversible: Postgres cannot drop a single enum value. Restore from a backup if needed.');
  }
};
