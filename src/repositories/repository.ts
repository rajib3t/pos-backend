export interface PaginationOptions<TEntity> {
    filter?: Partial<Record<keyof TEntity | string, any>>;
    page?: number;
    limit?: number;
    sort?: Record<string, 1 | -1>;
    projection?: Record<string, 0 | 1>;
}

export interface PaginatedResult<TEntity> {
    items: TEntity[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export abstract class Repository<TEntity, TCreate = Partial<TEntity>, TUpdate = Partial<TEntity>> {
    /**
     * Create a new entity
     */
    abstract create(data: TCreate): Promise<TEntity>;

    /**
     * Get all entities
     */
    abstract findAll(): Promise<TEntity[]>;

    /**
     * Get entity by id
     */
    abstract findById(id: string): Promise<TEntity | null>;

    /**
     * Update entity by id
     */
    abstract update(id: string, data: TUpdate): Promise<TEntity | null>;

    /**
     * Delete entity by id
     */
    abstract delete(id: string): Promise<TEntity | null | { deletedCount?: number }>;

    /**
     * Get entities with pagination
     */
    abstract findPaginated(options?: PaginationOptions<TEntity>): Promise<PaginatedResult<TEntity>>;
}