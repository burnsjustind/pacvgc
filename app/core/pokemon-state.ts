import {FLYING_PROTECT_THRESHOLD} from '../models/enum';
import { Item } from '../types/enum/Item';
import { Pkm } from '../types/enum/Pokemon';
import { Effect } from '../types/enum/Effect';
import { AttackType } from '../types/enum/Game';
import PokemonFactory from '../models/pokemon-factory';
import Board from './board';
import PokemonEntity from './pokemon-entity';
import { IPokemonEntity } from '../types';
import { Synergy } from '../types/enum/Synergy';

export default class PokemonState {

  handleHeal(pokemon: IPokemonEntity, heal: number, caster: IPokemonEntity): void {
    if (pokemon.life > 0 && pokemon.life < pokemon.hp && !pokemon.status.wound) {
      pokemon.life = Math.min(pokemon.hp, pokemon.life + Math.round(heal));
      if (caster) {
        caster.healDone += heal;
      }
    }
  }

  handleShield(pokemon: IPokemonEntity, shield: number, caster: IPokemonEntity) {
    if (pokemon.life > 0) {
      pokemon.shield += Math.round(shield);
      if (caster) {
        caster.shieldDone += shield;
      }
    }
  }

  handleDamage(pokemon: PokemonEntity, damage: number, board: Board, attackType: AttackType, attacker: PokemonEntity): boolean {
    let death: boolean;

    if (pokemon.life == 0) {
      death = true;
    } else {
      death = false;
      if (!pokemon.status.protect) {
        let reducedDamage = damage;
        if (attacker && attacker.items.has(Item.FIRE_GEM)) {
          if (pokemon.life > 200) {
            reducedDamage = Math.ceil(reducedDamage * 1.6);
          } else {
            reducedDamage = Math.ceil(reducedDamage * 1.2);
          }
        }
        const armorFactor = 0.1;
        const def = attacker && attacker.items.has(Item.RAZOR_FANG) ? Math.round( 0.7 * pokemon.def): pokemon.def;
        const speDef = attacker && attacker.items.has(Item.RAZOR_FANG) ? Math.round( 0.7 * pokemon.speDef): pokemon.speDef;
        if (attackType == AttackType.PHYSICAL) {
          const ritodamage = damage * (pokemon.life / (pokemon.life * (1 + (armorFactor * def))));
          reducedDamage = Math.max(0, Math.round(ritodamage));
        } else if (attackType == AttackType.SPECIAL) {
          const ritodamage = damage * (pokemon.life / (pokemon.life * (1 + (armorFactor * speDef))));
          reducedDamage = Math.max(0, Math.round(ritodamage));
        } else if (attackType == AttackType.TRUE) {
          reducedDamage = damage;
        }

        if (attacker && attacker.effects.includes(Effect.PURSUIT) && pokemon.life/pokemon.hp < 0.3) {
          reducedDamage = pokemon.life + 1;
        }

        if (!reducedDamage) {
          reducedDamage = 0;
          // console.log(`error calculating damage, damage: ${damage}, defenseur: ${pokemon.name}, attaquant: ${attacker.name}, attack type: ${attackType}, defense : ${pokemon.def}, spedefense: ${pokemon.speDef}, life: ${pokemon.life}`);
        }

        if (pokemon.dodge > Math.random()) {
          if (!(attacker && attacker.items.has(Item.XRAY_VISION))) {
            reducedDamage = 0;
            pokemon.count.dodgeCount += 1;
          }
        }

        if (attacker && reducedDamage > 0) {
          switch (attackType) {
            case AttackType.PHYSICAL:
              attacker.physicalDamage += reducedDamage;
              break;

            case AttackType.SPECIAL:
              attacker.specialDamage += reducedDamage;
              break;

            case AttackType.TRUE:
              attacker.trueDamage += reducedDamage;
              break;

            default:
              break;
          }
        }
        let residualDamage = reducedDamage;

        if (pokemon.shield > 0) {
          residualDamage = Math.max(0, reducedDamage - pokemon.shield);
          pokemon.shield = Math.max(0, pokemon.shield - reducedDamage);
        }

        pokemon.life = Math.max(0, pokemon.life - residualDamage);
        // console.log(`${pokemon.name} took ${damage} and has now ${pokemon.life} life shield ${pokemon.shield}`);

        if (pokemon) {
          pokemon.setMana(pokemon.mana + Math.ceil(reducedDamage / 10));

          if (pokemon.items.has(Item.DEFENSIVE_RIBBON) && pokemon.count.defensiveRibbonCount <5) {
            pokemon.atk ++;
            pokemon.def ++;
            pokemon.speDef ++;
            pokemon.count.defensiveRibbonCount ++;
          }

          if (pokemon.life && pokemon.life > 0) {
            if (pokemon.flyingProtection) {
              if (pokemon.effects.includes(Effect.TAILWIND)) {
                if (pokemon.life/pokemon.hp < FLYING_PROTECT_THRESHOLD[Effect.TAILWIND].threshold) {
                  pokemon.status.triggerProtect(FLYING_PROTECT_THRESHOLD[Effect.TAILWIND].duration);
                  pokemon.flyingProtection = false;
                }
              } else if (pokemon.effects.includes(Effect.FEATHER_DANCE)) {
                if (pokemon.life/pokemon.hp < FLYING_PROTECT_THRESHOLD[Effect.FEATHER_DANCE].threshold) {
                  pokemon.status.triggerProtect(FLYING_PROTECT_THRESHOLD[Effect.FEATHER_DANCE].duration);
                  pokemon.flyingProtection = false;
                }
              } else if (pokemon.effects.includes(Effect.MAX_AIRSTREAM)) {
                if (pokemon.life/pokemon.hp < FLYING_PROTECT_THRESHOLD[Effect.MAX_AIRSTREAM].threshold) {
                  pokemon.status.triggerProtect(FLYING_PROTECT_THRESHOLD[Effect.MAX_AIRSTREAM].duration);
                  pokemon.flyingProtection = false;
                }
              } else if (pokemon.effects.includes(Effect.MAX_GUARD)) {
                if (pokemon.life/pokemon.hp < FLYING_PROTECT_THRESHOLD[Effect.MAX_GUARD].threshold) {
                  pokemon.status.triggerProtect(FLYING_PROTECT_THRESHOLD[Effect.MAX_GUARD].duration);
                  pokemon.flyingProtection = false;
                }
              }
            }
          }
        }

        if (attacker) {
          attacker.setMana(attacker.mana + 5);
          if (attacker.effects.includes(Effect.CALM_MIND) || attacker.effects.includes(Effect.FOCUS_ENERGY) || attacker.effects.includes(Effect.MEDITATE)) {
            let lifesteal = 0;
            if (attacker.effects.includes(Effect.MEDITATE)) {
              lifesteal = 0.15;
            } else if (attacker.effects.includes(Effect.FOCUS_ENERGY)) {
              lifesteal = 0.3;
            } else if (attacker.effects.includes(Effect.CALM_MIND)) {
              lifesteal = 0.6;
            }
            attacker.handleHeal(Math.floor(lifesteal * residualDamage), attacker);
          }
          if (attacker.items.has(Item.KINGS_ROCK)) {
            attacker.handleHeal(Math.floor(0.5 * residualDamage), attacker);
          }

          if (attacker.effects.includes(Effect.BLAZE) || attacker.effects.includes(Effect.DROUGHT) || attacker.effects.includes(Effect.DESOLATE_LAND)) {
            let burnChance = 0;
            if (attacker.effects.includes(Effect.BLAZE)) {
              burnChance = 0.1;
            } else if (attacker.effects.includes(Effect.DROUGHT)) {
              burnChance = 0.2;
            } else if (attacker.effects.includes(Effect.DESOLATE_LAND)) {
              burnChance = 0.3;
            }
            if (Math.random() < burnChance) {
              pokemon.status.triggerBurn(2000, pokemon, attacker);
            }
          }
        }

        if (!pokemon.life || pokemon.life <= 0) {
          if (pokemon.items.has(Item.MAX_REVIVE)) {
            pokemon.life = pokemon.hp;
            pokemon.items.delete(Item.MAX_REVIVE);
          } else if (pokemon.effects.includes(Effect.SWIFT_SWIM)) {
            pokemon.status.triggerProtect(1000);
            pokemon.life = pokemon.hp * 0.4;
            pokemon.atk += pokemon.baseAtk * 0.3;
            pokemon.effects.splice(pokemon.effects.findIndex((e) => e === Effect.SWIFT_SWIM), 1);
          } else if (pokemon.effects.includes(Effect.HYDRO_CANNON)) {
            pokemon.status.triggerProtect(1000);
            pokemon.life = pokemon.hp * 0.8;
            pokemon.atk += pokemon.baseAtk *0.6;
            pokemon.effects.splice(pokemon.effects.findIndex((e) => e === Effect.HYDRO_CANNON), 1);
          } else if (pokemon.status.resurection) {
            pokemon.status.resurection = false;
            pokemon.life = pokemon.hp;
          } else {
            const isWorkUp = pokemon.effects.includes(Effect.BULK_UP);
            const isRage = pokemon.effects.includes(Effect.RAGE);
            const isAngerPoint = pokemon.effects.includes(Effect.ANGER_POINT);

            if (isWorkUp || isRage || isAngerPoint) {
              let boost = 0;
              let speedBoost = 0;
              if (isWorkUp) {
                boost = 30;
                speedBoost = 20;
              } else if (isRage) {
                boost = 40;
                speedBoost = 30;
              } else if (isAngerPoint) {
                boost = 60;
                speedBoost = 50;
              }
              board.forEach((r, c, value) => {
                if (value !== undefined && value.team == pokemon.team && value.types.includes(Synergy.FIELD)) {
                  value.count.fieldCount ++;
                  value.handleHeal(boost / 100 * value.hp, pokemon);
                  value.handleAttackSpeed(speedBoost);
                }
              });
            }

            board.setValue(pokemon.positionX, pokemon.positionY, undefined);
            death = true;
          }
        }
      }
    }

    if (death && pokemon) {
      if (pokemon.effects.includes(Effect.ODD_FLOWER) ||
      pokemon.effects.includes(Effect.GLOOM_FLOWER) ||
      pokemon.effects.includes(Effect.VILE_FLOWER) ||
      pokemon.effects.includes(Effect.SUN_FLOWER)) {
        if (!pokemon.simulation.flowerSpawn[pokemon.team]) {
          pokemon.simulation.flowerSpawn[pokemon.team] = true;
          if (pokemon.effects.includes(Effect.ODD_FLOWER)) {
            pokemon.simulation.addPokemon(PokemonFactory.createPokemonFromName(Pkm.ODDISH), pokemon.positionX, pokemon.positionY, pokemon.team);
          } else if (pokemon.effects.includes(Effect.GLOOM_FLOWER)) {
            pokemon.simulation.addPokemon(PokemonFactory.createPokemonFromName(Pkm.GLOOM), pokemon.positionX, pokemon.positionY, pokemon.team);
          } else if (pokemon.effects.includes(Effect.VILE_FLOWER)) {
            pokemon.simulation.addPokemon(PokemonFactory.createPokemonFromName(Pkm.VILEPLUME), pokemon.positionX, pokemon.positionY, pokemon.team);
          } else if (pokemon.effects.includes(Effect.SUN_FLOWER)) {
            pokemon.simulation.addPokemon(PokemonFactory.createPokemonFromName(Pkm.BELLOSSOM), pokemon.positionX, pokemon.positionY, pokemon.team);
          }
        }
      }
    }
    return death;
  }

  update(pokemon: PokemonEntity, dt: number, board: Board, climate: string) {
    let updateEffects = false;
    if (pokemon.effects.includes(Effect.SHORE_UP) || pokemon.effects.includes(Effect.ROTOTILLER) || pokemon.effects.includes(Effect.SANDSTORM)) {
      if (pokemon.growGroundTimer !== undefined && pokemon.count.growGroundCount <5) {
        pokemon.growGroundTimer -= dt;
        if (pokemon.growGroundTimer <= 0) {
          pokemon.growGroundTimer = 2000;
          pokemon.count.growGroundCount += 1;
          if (pokemon.effects.includes(Effect.SHORE_UP)) {
            pokemon.def += 1;
            pokemon.speDef += 1;
            pokemon.atk += 1;
          } else if (pokemon.effects.includes(Effect.ROTOTILLER)) {
            pokemon.def += 2;
            pokemon.speDef += 2;
            pokemon.atk += 2;
          } else if (pokemon.effects.includes(Effect.SANDSTORM)) {
            pokemon.def += 3;
            pokemon.speDef += 3;
            pokemon.atk += 3;
          }
        }
      } else {
        pokemon.growGroundTimer = 2000;
      }
    }

    if (pokemon.status.burn) {
      pokemon.status.updateBurn(dt);
    }

    if (pokemon.status.poison) {
      pokemon.status.updatePoison(dt);
    }

    if (pokemon.status.sleep) {
      pokemon.status.updateSleep(dt);
    }

    if (pokemon.status.silence) {
      pokemon.status.updateSilence(dt);
    }

    if (pokemon.status.protect) {
      pokemon.status.updateProtect(dt);
    }

    if (pokemon.status.freeze) {
      pokemon.status.updateFreeze(dt);
    }

    if (pokemon.status.confusion) {
      pokemon.status.updateConfusion(dt);
    }

    if (pokemon.status.wound) {
      pokemon.status.updateWound(dt);
    }

    if (pokemon.status.temporaryShield) {
      pokemon.status.updateShield(dt, pokemon);
    }

    if (pokemon.status.soulDew) {
      pokemon.status.updateSoulDew(dt, pokemon);
    }

    if (pokemon.status.brightPowder) {
      pokemon.status.updateBrightPowder(dt, pokemon, board);
    }

    if (pokemon.status.smoke) {
      pokemon.status.updateSmoke(dt, pokemon);
    }

    if (pokemon.status.armorReduction) {
      pokemon.status.updateArmorReduction(dt);
    }

    if (pokemon.status.flameOrb) {
      pokemon.status.updateFlameOrb(dt, pokemon, board);
    }

    if (pokemon.manaCooldown <= 0) {
      pokemon.setMana(pokemon.mana + 10);

      pokemon.manaCooldown = 1000;
      if (pokemon.mana >= pokemon.maxMana) {
        if (pokemon.targetX == -1 || pokemon.targetY == -1) {
          const targetCoordinate = this.getNearestTargetCoordinate(pokemon, board);
          if (targetCoordinate[0] !== undefined && targetCoordinate[1] !== undefined) {
            pokemon.targetX = targetCoordinate[0];
            pokemon.targetY = targetCoordinate[1];
          }
        }
        const target = board.getValue(pokemon.targetX, pokemon.targetY);
        if (target) {
          pokemon.strategy.process(pokemon, this, board, target);
          updateEffects = true;
        }
      }
    } else {
      pokemon.manaCooldown = Math.max(0, pokemon.manaCooldown - dt);
    }

    if (pokemon.cooldown <= 0) {
      if (pokemon.status.burn && pokemon.status.burnOrigin) {
        this.handleDamage(pokemon, Math.ceil(pokemon.hp *0.05), board, AttackType.TRUE, pokemon.status.burnOrigin);
      }

      if (pokemon.status.poison && pokemon.status.poisonOrigin) {
        this.handleDamage(pokemon, Math.ceil(pokemon.hp *0.10), board, AttackType.TRUE, pokemon.status.poisonOrigin);
      }

      if (pokemon.effects.includes(Effect.BLAZE)) {
        pokemon.atk += 1;
      }

      if (pokemon.effects.includes(Effect.DROUGHT)) {
        pokemon.atk += 2;
      }

      if (pokemon.effects.includes(Effect.DESOLATE_LAND)) {
        pokemon.atk += 3;
      }

      if (pokemon.effects.includes(Effect.DRAGON_ENERGY) && pokemon.types.includes(Synergy.DRAGON)) {
        pokemon.handleAttackSpeed(3);
      }

      if (pokemon.effects.includes(Effect.DRAGON_DANCE) && pokemon.types.includes(Synergy.DRAGON)) {
        pokemon.handleAttackSpeed(6);
      }

      if (pokemon.effects.includes(Effect.INGRAIN)) {
        pokemon.handleHeal(4, pokemon);
      }

      if (pokemon.effects.includes(Effect.GROWTH)) {
        pokemon.handleHeal(8, pokemon);
      }

      if (pokemon.effects.includes(Effect.SPORE)) {
        pokemon.handleHeal(16, pokemon);
      }
    }
    return updateEffects;
  }

  onEnter(pokemon: PokemonEntity) {
  }

  onExit(pokemon: PokemonEntity) {
  }

  isTarget(pokemon: PokemonEntity, board: Board) {
    let target = false;
    board.forEach((x, y, value) => {
      if (value && value.team != pokemon.team) {
        target = true;
      }
    });
    return target;
  }

  getNearestTargetCoordinate(pokemon: PokemonEntity, board: Board) {
    let x = undefined;
    let y = undefined;
    let distance = 999;
    board.forEach((r: number, c: number, value: PokemonEntity) => {
      if (value !== undefined && value.team != pokemon.team) {
        const candidateDistance = board.distance(pokemon.positionX, pokemon.positionY, r, c);
        if (candidateDistance < distance) {
          distance = candidateDistance;
          x = r;
          y = c;
        } else if (candidateDistance == distance) {
          if (pokemon.team == 0 && c > y) {
            x = r;
            y = c;
          } else if (pokemon.team == 1 && c < y) {
            x = r;
            y = c;
          }
        }
      }
    });
    return [x, y];
  }

  getFarthestTargetCoordinate(pokemon: PokemonEntity, board: Board) {
    const pokemons = [];

    board.forEach((r: number, c: number, value: PokemonEntity)=>{
      if (value !== undefined && value.team != pokemon.team) {
        const d = board.distance(pokemon.positionX, pokemon.positionY, r, c);
        pokemons.push({distance: d, x: r, y: c});
      }
    });

    pokemons.sort((a, b)=>{
      return b.distance-a.distance;
    });

    return [pokemons[0].x, pokemons[0].y];
  }

  getFarthestTargetCoordinateAvailablePlace(pokemon: PokemonEntity, board: Board) {
    let x = undefined;
    let y = undefined;
    const pokemons = [];

    board.forEach((r: number, c: number, value: PokemonEntity)=>{
      if (value !== undefined && value.team != pokemon.team) {
        const d = board.distance(pokemon.positionX, pokemon.positionY, r, c);
        pokemons.push({distance: d, x: r, y: c});
      }
    });

    pokemons.sort((a, b)=>{
      return b.distance-a.distance;
    });

    for (let i = 0; i < pokemons.length; i++) {
      const p = pokemons[i];
      const around = board.getAdjacentCells(p.x, p.y);

      around.sort((a, b)=>{
        return board.distance(b.row, b.column, pokemon.positionX, pokemon.positionY) -
        board.distance(a.row, a.column, pokemon.positionX, pokemon.positionY);
      });
      around.forEach((cell) => {
        if (!cell.value && x === undefined && y === undefined) {
          x = cell.row;
          y = cell.column;
        }
      });
      if (x !== undefined && y !== undefined) {
        break;
      }
    }
    return [x, y];
  }

  move(pokemon: PokemonEntity, board: Board, coordinates: number[]) {}
};