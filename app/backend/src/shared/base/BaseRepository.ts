/**
 * Pure data-access contract. No database logic lives here or in any
 * concrete subclass under this milestone — it exists only so future
 * repositories share one shape.
 */
export abstract class BaseRepository<TEntity, TId = string> {
  abstract findById(id: TId): Promise<TEntity | null>;
  abstract findAll(): Promise<TEntity[]>;
  abstract save(entity: TEntity): Promise<void>;
  abstract delete(id: TId): Promise<void>;
}
