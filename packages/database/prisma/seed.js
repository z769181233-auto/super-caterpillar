'use strict';
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g = Object.create((typeof Iterator === 'function' ? Iterator : Object).prototype);
    return (
      (g.next = verb(0)),
      (g['throw'] = verb(1)),
      (g['return'] = verb(2)),
      typeof Symbol === 'function' &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError('Generator is already executing.');
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y['return']
                  : op[0]
                    ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                    : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
Object.defineProperty(exports, '__esModule', { value: true });
var prisma_1 = require('../src/generated/prisma');
var prisma = new prisma_1.PrismaClient();
function main() {
  return __awaiter(this, void 0, void 0, function () {
    var engines, _i, engines_1, e, engine;
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          console.log('🌱 Seeding Engine data...');
          engines = [
            {
              code: 'default_novel_analysis',
              name: 'Default Novel Analysis',
              type: 'local',
              isActive: true,
              engineKey: 'default_novel_analysis',
              adapterName: 'default_novel_analysis',
              adapterType: 'local',
              config: {},
              enabled: true,
            },
            {
              code: 'default_shot_render',
              name: 'Default Shot Render',
              type: 'local',
              isActive: true,
              engineKey: 'default_shot_render',
              adapterName: 'default_shot_render',
              adapterType: 'local',
              config: {},
              enabled: true,
            },
            // HTTP 引擎（如果后续要用就先建好）
            {
              code: 'http_real_novel_analysis',
              name: 'HTTP Novel Analysis',
              type: 'http',
              isActive: true,
              engineKey: 'http_real_novel_analysis',
              adapterName: 'http',
              adapterType: 'http',
              config: {},
              enabled: true,
            },
            {
              code: 'http_real_shot_render',
              name: 'HTTP Shot Render',
              type: 'http',
              isActive: true,
              engineKey: 'http_real_shot_render',
              adapterName: 'http',
              adapterType: 'http',
              config: {},
              enabled: true,
            },
          ];
          ((_i = 0), (engines_1 = engines));
          _a.label = 1;
        case 1:
          if (!(_i < engines_1.length)) return [3 /*break*/, 7];
          e = engines_1[_i];
          return [
            4 /*yield*/,
            prisma.engine.findUnique({
              where: { engineKey: e.engineKey },
            }),
          ];
        case 2:
          engine = _a.sent();
          if (!engine) return [3 /*break*/, 4];
          return [
            4 /*yield*/,
            prisma.engine.update({
              where: { engineKey: e.engineKey },
              data: {
                code: e.code,
                name: e.name,
                type: e.type,
                isActive: e.isActive,
                adapterName: e.adapterName,
                adapterType: e.adapterType,
                config: e.config,
                enabled: e.enabled,
              },
            }),
          ];
        case 3:
          // 如果存在，更新字段（包括新增的 code, name, type, isActive）
          engine = _a.sent();
          console.log(
            '\u2705 Updated engine: '
              .concat(engine.engineKey, ' -> code: ')
              .concat(e.code, ' (')
              .concat(e.name, ')')
          );
          return [3 /*break*/, 6];
        case 4:
          return [
            4 /*yield*/,
            prisma.engine.create({
              data: e,
            }),
          ];
        case 5:
          // 如果不存在，创建新记录
          engine = _a.sent();
          console.log(
            '\u2705 Created engine: '
              .concat(engine.engineKey, ' -> code: ')
              .concat(e.code, ' (')
              .concat(e.name, ')')
          );
          _a.label = 6;
        case 6:
          _i++;
          return [3 /*break*/, 1];
        case 7:
          console.log('✅ Engine seeding completed!');
          return [2 /*return*/];
      }
    });
  });
}
main()
  .then(function () {
    return __awaiter(void 0, void 0, void 0, function () {
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            return [4 /*yield*/, prisma.$disconnect()];
          case 1:
            _a.sent();
            return [2 /*return*/];
        }
      });
    });
  })
  .catch(function (e) {
    return __awaiter(void 0, void 0, void 0, function () {
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            console.error('❌ Seeding failed:', e);
            return [4 /*yield*/, prisma.$disconnect()];
          case 1:
            _a.sent();
            process.exit(1);
            return [2 /*return*/];
        }
      });
    });
  });
