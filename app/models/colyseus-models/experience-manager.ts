import {Schema, type} from '@colyseus/schema';
import { IExperienceManager } from '../../types';
import { EXP_TABLE } from '../enum';
export default class ExperienceManager extends Schema implements IExperienceManager{

  @type('uint8') level: number;
  @type('uint8') experience: number;
  @type('uint8') expNeeded: number;
  maxLevel: number;

  constructor(){
    super();
    this.level = 2;
    this.experience = 0;
    this.expNeeded = EXP_TABLE[2];
    this.maxLevel = 9;
  }

  canLevel() {
    return (this.level < this.maxLevel);
  }

  addExperience(quantity: number) {
    let expToAdd = quantity;
    while (this.checkForLevelUp(expToAdd)) {
      expToAdd -= EXP_TABLE[this.level];
      this.level += 1;
      this.expNeeded = EXP_TABLE[this.level];
    }
  }

  checkForLevelUp(quantity: number) {
    if (this.experience + quantity >= EXP_TABLE[this.level] && this.level < this.maxLevel) {
      return true;
    } else {
      this.experience += quantity;
      return false;
    }
  }
}