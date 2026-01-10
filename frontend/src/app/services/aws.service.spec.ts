/**
 * Tests pour le service AWS
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AWSService } from './aws.service';
import { AWSCredentials } from '../models/aws.models';

describe('AWSService', () => {
  let service: AWSService;
  let httpMock: HttpTestingController;

  const mockCredentials: AWSCredentials = {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AWSService]
    });

    service = TestBed.inject(AWSService);
    httpMock = TestBed.inject(HttpTestingController);

    // Clear sessionStorage
    sessionStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('devrait être créé', () => {
    // Ignore the initial services request
    const req = httpMock.expectOne('http://localhost:3000/services');
    req.flush({ success: true, data: { services: [] } });

    expect(service).toBeTruthy();
  });

  describe('loadServices', () => {
    it('devrait charger les services AWS', (done) => {
      const mockServices = [
        { id: 'ec2', name: 'EC2', category: 'compute', description: 'Instances' },
        { id: 's3', name: 'S3', category: 'storage', description: 'Stockage' }
      ];

      service.services$.subscribe(services => {
        if (services.length > 0) {
          expect(services).toEqual(mockServices);
          done();
        }
      });

      const req = httpMock.expectOne('http://localhost:3000/services');
      req.flush({ success: true, data: { services: mockServices } });
    });
  });

  describe('validateCredentials', () => {
    it('devrait valider les credentials valides', (done) => {
      // Ignore initial services load
      httpMock.expectOne('http://localhost:3000/services').flush({ success: true, data: { services: [] } });

      service.validateCredentials(mockCredentials).subscribe({
        next: (result) => {
          expect(result.accountId).toBe('123456789012');
          expect(service.isAuthenticated()).toBe(true);
          done();
        }
      });

      const req = httpMock.expectOne('http://localhost:3000/validate');
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('X-AWS-Access-Key-Id')).toBe(mockCredentials.accessKeyId);
      expect(req.request.headers.get('X-AWS-Secret-Access-Key')).toBe(mockCredentials.secretAccessKey);

      req.flush({
        success: true,
        data: { accountId: '123456789012' },
        timestamp: new Date().toISOString()
      });
    });

    it('devrait rejeter les credentials invalides', (done) => {
      httpMock.expectOne('http://localhost:3000/services').flush({ success: true, data: { services: [] } });

      service.validateCredentials(mockCredentials).subscribe({
        error: (err) => {
          expect(err.message).toBe('Invalid credentials');
          expect(service.isAuthenticated()).toBe(false);
          done();
        }
      });

      const req = httpMock.expectOne('http://localhost:3000/validate');
      req.flush({
        success: false,
        error: 'Invalid credentials',
        timestamp: new Date().toISOString()
      });
    });
  });

  describe('logout', () => {
    it('devrait déconnecter l\'utilisateur', () => {
      httpMock.expectOne('http://localhost:3000/services').flush({ success: true, data: { services: [] } });

      // Set authenticated state
      sessionStorage.setItem('aws_credentials', JSON.stringify(mockCredentials));
      sessionStorage.setItem('aws_account_id', '123456789012');

      service.logout();

      expect(service.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem('aws_credentials')).toBeNull();
      expect(sessionStorage.getItem('aws_account_id')).toBeNull();
    });
  });

  describe('runAudit', () => {
    it('devrait exécuter un audit', (done) => {
      httpMock.expectOne('http://localhost:3000/services').flush({ success: true, data: { services: [] } });

      // Set credentials
      sessionStorage.setItem('aws_credentials', JSON.stringify(mockCredentials));
      sessionStorage.setItem('aws_account_id', '123456789012');

      const mockResults = {
        accountId: '123456789012',
        results: {
          cost: { data: {}, issues: [] }
        }
      };

      service.runAudit({ services: ['costexplorer'] }).subscribe({
        next: (result) => {
          expect(result.accountId).toBe('123456789012');
          done();
        }
      });

      const req = httpMock.expectOne('http://localhost:3000/audit');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ services: ['costexplorer'] });

      req.flush({
        success: true,
        data: mockResults,
        timestamp: new Date().toISOString()
      });
    });
  });

  describe('getServicesByCategory', () => {
    it('devrait grouper les services par catégorie', (done) => {
      const mockServices = [
        { id: 'ec2', name: 'EC2', category: 'compute', description: 'Instances' },
        { id: 'lambda', name: 'Lambda', category: 'compute', description: 'Functions' },
        { id: 's3', name: 'S3', category: 'storage', description: 'Stockage' }
      ];

      httpMock.expectOne('http://localhost:3000/services').flush({
        success: true,
        data: { services: mockServices }
      });

      service.getServicesByCategory().subscribe(grouped => {
        if (grouped.size > 0) {
          expect(grouped.get('compute')?.length).toBe(2);
          expect(grouped.get('storage')?.length).toBe(1);
          done();
        }
      });
    });
  });
});
