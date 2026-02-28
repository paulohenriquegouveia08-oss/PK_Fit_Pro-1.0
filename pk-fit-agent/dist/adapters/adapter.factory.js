"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdapter = createAdapter;
const controlid_adapter_1 = require("./controlid.adapter");
const topdata_adapter_1 = require("./topdata.adapter");
const henry_adapter_1 = require("./henry.adapter");
const logger_1 = require("../core/logger");
/**
 * Factory — cria o adaptador correto baseado na marca configurada.
 * O Agent não precisa saber qual marca é, só usa a interface.
 */
function createAdapter(config) {
    logger_1.logger.info(`Criando adaptador para marca: ${config.brand}`);
    switch (config.brand) {
        case 'CONTROL_ID':
            return new controlid_adapter_1.ControlIdAdapter(config.ip, config.port, config.authUser, config.authPassword);
        case 'TOP_DATA':
            return new topdata_adapter_1.TopDataAdapter(config.ip, config.port, config.authUser, config.authPassword);
        case 'HENRY':
            return new henry_adapter_1.HenryAdapter(config.ip, config.port, config.authUser, config.authPassword);
        default:
            throw new Error(`❌ Marca de catraca não suportada: ${config.brand}`);
    }
}
//# sourceMappingURL=adapter.factory.js.map