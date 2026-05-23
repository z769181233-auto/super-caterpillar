import { ProjectService } from './project.service';

describe('ProjectService delete cleanup', () => {
  it('removes project-linked restrict records before deleting the project', async () => {
    const characterAliasDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const scriptBuildDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const billingEventDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const locationDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const propDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const outfitDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const characterDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const novelSourceDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const projectDelete = jest.fn().mockResolvedValue({ id: 'project-1' });

    const prisma = {
      $transaction: jest.fn().mockImplementation(async (callback: any) =>
        callback({
          characterAlias: { deleteMany: characterAliasDeleteMany },
          scriptBuild: { deleteMany: scriptBuildDeleteMany },
          billingEvent: { deleteMany: billingEventDeleteMany },
          location: { deleteMany: locationDeleteMany },
          prop: { deleteMany: propDeleteMany },
          outfit: { deleteMany: outfitDeleteMany },
          character: { deleteMany: characterDeleteMany },
          novelSource: { deleteMany: novelSourceDeleteMany },
          project: { delete: projectDelete },
        }),
      ),
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'project-1',
          ownerId: 'user-1',
        }),
      },
    } as any;

    const invalidateProjectSceneGraph = jest.fn().mockResolvedValue(undefined);

    const service = new ProjectService(
      prisma,
      { invalidateProjectSceneGraph } as any,
      {} as any,
      {} as any
    );

    const result = await service.delete('project-1');

    expect(result).toEqual({ id: 'project-1' });
    expect(characterAliasDeleteMany).toHaveBeenCalledWith({
      where: {
        character: {
          projectId: 'project-1',
        },
      },
    });
    expect(scriptBuildDeleteMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
    });
    expect(billingEventDeleteMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
    });
    expect(locationDeleteMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
    });
    expect(propDeleteMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
    });
    expect(outfitDeleteMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
    });
    expect(characterDeleteMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
    });
    expect(novelSourceDeleteMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
    });
    expect(projectDelete).toHaveBeenCalledWith({
      where: { id: 'project-1' },
    });
    expect(invalidateProjectSceneGraph).toHaveBeenCalledWith('project-1');
  });
});
