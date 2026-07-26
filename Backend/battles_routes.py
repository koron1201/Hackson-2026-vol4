from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class BattleRequest(BaseModel):
    itemIds: list[str]
    clientEventId: str


@router.post('/battles')
def battle(req: BattleRequest):
    # Simple deterministic damage: 10 per item
    damage = len(req.itemIds) * 10
    enemyHp = max(0, 700 - damage)
    return {'damage': damage, 'enemyHp': enemyHp}
