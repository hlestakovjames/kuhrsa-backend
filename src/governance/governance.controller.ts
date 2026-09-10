import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { Permissions } from '../auth/decorators/permissions/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions/permissions.guard';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';

import { CreatePositionAssignmentDto } from './dto/create-position-assignment.dto';
import { CreatePositionDto } from './dto/create-position.dto';
import { CreateTermDto } from './dto/create-term.dto';
import { UpdatePositionAssignmentDto } from './dto/update-position-assignment.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { UpdateTermDto } from './dto/update-term.dto';
import { GovernanceService } from './governance.service';

@Controller('governance')
@UseGuards(AuthGuard('jwt'))
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceService) {}

  // ---------------------------------------------------------------------------
  // CURRENT USER GOVERNANCE
  // ---------------------------------------------------------------------------

  @Get('me')
  async findMyGovernance(@Request() req: AuthenticatedRequest) {
    return this.governanceService.findMyGovernance(
      req.user.id,
      req.user.organizationId,
    );
  }

  // ---------------------------------------------------------------------------
  // POSITIONS
  // ---------------------------------------------------------------------------

  @Get('positions')
  @UseGuards(PermissionsGuard)
  @Permissions('governance.positions.view')
  async findAllPositions(@Request() req: AuthenticatedRequest) {
    return this.governanceService.findAllPositions(req.user.organizationId);
  }

  @Get('positions/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('governance.positions.view')
  async findOnePosition(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.governanceService.findOnePosition(id, req.user.organizationId);
  }

  @Post('positions')
  @UseGuards(PermissionsGuard)
  @Permissions('governance.positions.manage')
  async createPosition(
    @Body() dto: CreatePositionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.governanceService.createPosition(
      req.user.organizationId,
      req.user.id,
      dto,
    );
  }

  @Patch('positions/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('governance.positions.manage')
  async updatePosition(
    @Param('id') id: string,
    @Body() dto: UpdatePositionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.governanceService.updatePosition(
      id,
      req.user.organizationId,
      req.user.id,
      dto,
    );
  }

  // ---------------------------------------------------------------------------
  // TERMS
  // ---------------------------------------------------------------------------

  @Get('terms')
  @UseGuards(PermissionsGuard)
  @Permissions('governance.terms.view')
  async findAllTerms(@Request() req: AuthenticatedRequest) {
    return this.governanceService.findAllTerms(req.user.organizationId);
  }

  @Get('terms/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('governance.terms.view')
  async findOneTerm(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.governanceService.findOneTerm(id, req.user.organizationId);
  }

  @Post('terms')
  @UseGuards(PermissionsGuard)
  @Permissions('governance.terms.manage')
  async createTerm(
    @Body() dto: CreateTermDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.governanceService.createTerm(
      req.user.organizationId,
      req.user.id,
      dto,
    );
  }

  @Patch('terms/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('governance.terms.manage')
  async updateTerm(
    @Param('id') id: string,
    @Body() dto: UpdateTermDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.governanceService.updateTerm(
      id,
      req.user.organizationId,
      req.user.id,
      dto,
    );
  }

  // ---------------------------------------------------------------------------
  // POSITION ASSIGNMENTS
  // ---------------------------------------------------------------------------

  @Get('assignments')
  @UseGuards(PermissionsGuard)
  @Permissions('governance.assignments.view')
  async findAllAssignments(@Request() req: AuthenticatedRequest) {
    return this.governanceService.findAllAssignments(req.user.organizationId);
  }

  @Get('assignments/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('governance.assignments.view')
  async findOneAssignment(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.governanceService.findOneAssignment(
      id,
      req.user.organizationId,
    );
  }

  @Post('assignments')
  @UseGuards(PermissionsGuard)
  @Permissions('governance.assignments.manage')
  async createPositionAssignment(
    @Body() dto: CreatePositionAssignmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.governanceService.createPositionAssignment(
      req.user.organizationId,
      req.user.id,
      dto,
    );
  }

  @Patch('assignments/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('governance.assignments.manage')
  async updatePositionAssignment(
    @Param('id') id: string,
    @Body() dto: UpdatePositionAssignmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.governanceService.updatePositionAssignment(
      id,
      req.user.organizationId,
      req.user.id,
      dto,
    );
  }

  @Post('assignments/:id/activate')
  @UseGuards(PermissionsGuard)
  @Permissions('governance.assignments.manage')
  async activatePositionAssignment(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.governanceService.activatePositionAssignment(
      id,
      req.user.organizationId,
      req.user.id,
    );
  }

  @Post('assignments/:id/end')
  @UseGuards(PermissionsGuard)
  @Permissions('governance.assignments.manage')
  async endPositionAssignment(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.governanceService.endPositionAssignment(
      id,
      req.user.organizationId,
      req.user.id,
    );
  }

  @Post('assignments/:id/revoke')
  @UseGuards(PermissionsGuard)
  @Permissions('governance.assignments.manage')
  async revokePositionAssignment(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.governanceService.revokePositionAssignment(
      id,
      req.user.organizationId,
      req.user.id,
    );
  }
}
