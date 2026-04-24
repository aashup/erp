<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\SalaryStructure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Employee::class);

        $employees = Employee::query()
            ->with(['department', 'designation', 'salaryStructure'])
            ->when($request->search, fn ($q, $s) => $q->where('name', 'like', "%{$s}%")
                ->orWhere('employee_code', 'like', "%{$s}%"))
            ->when($request->department_id, fn ($q, $d) => $q->where('department_id', $d))
            ->when($request->boolean('active_only'), fn ($q) => $q->where('is_active', true));

        if ($request->sort_by) {
            $sortOrder = $request->sort_order === 'desc' ? 'desc' : 'asc';
            match ($request->sort_by) {
                'name'         => $employees->orderBy('name', $sortOrder),
                'employee_code' => $employees->orderBy('employee_code', $sortOrder),
                'joining_date' => $employees->orderBy('joining_date', $sortOrder),
                default        => $employees->orderBy('name'),
            };
        } else {
            $employees->orderBy('name');
        }

        return response()->json($employees->paginate($request->per_page ?? 25));
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Employee::class);

        $validated = $request->validate([
            'employee_code'     => 'nullable|string|max:50',
            'name'              => 'required|string|max:255',
            'gender'            => 'nullable|in:male,female,other',
            'date_of_birth'     => 'nullable|date',
            'phone'             => 'nullable|string|max:20',
            'email'             => 'nullable|email',
            'address'           => 'nullable|string',
            'city'              => 'nullable|string|max:100',
            'state'             => 'nullable|string|max:100',
            'department_id'     => 'nullable|exists:departments,id',
            'designation_id'    => 'nullable|exists:designations,id',
            'joining_date'      => 'required|date',
            'employment_type'   => 'nullable|in:permanent,contract,part_time',
            'bank_account_name' => 'nullable|string|max:255',
            'bank_account_no'   => 'nullable|string|max:30',
            'bank_ifsc'         => 'nullable|string|max:15',
            'bank_name'         => 'nullable|string|max:255',
            'pan'               => 'nullable|string|max:10',
            'pf_number'         => 'nullable|string|max:30',
            'esi_number'        => 'nullable|string|max:30',
            'is_pf_applicable'  => 'boolean',
            'is_esi_applicable' => 'boolean',
        ]);

        $employee = Employee::create($validated);

        return response()->json(['data' => $employee->load(['department', 'designation'])], 201);
    }

    public function show(Employee $employee): JsonResponse
    {
        $this->authorize('view', $employee);

        return response()->json(['data' => $employee->load(['department', 'designation', 'salaryStructure'])]);
    }

    public function update(Request $request, Employee $employee): JsonResponse
    {
        $this->authorize('update', $employee);

        $validated = $request->validate([
            'employee_code'     => 'nullable|string|max:50',
            'name'              => 'sometimes|string|max:255',
            'gender'            => 'nullable|in:male,female,other',
            'date_of_birth'     => 'nullable|date',
            'phone'             => 'nullable|string|max:20',
            'email'             => 'nullable|email',
            'address'           => 'nullable|string',
            'city'              => 'nullable|string|max:100',
            'state'             => 'nullable|string|max:100',
            'department_id'     => 'nullable|exists:departments,id',
            'designation_id'    => 'nullable|exists:designations,id',
            'joining_date'      => 'sometimes|date',
            'employment_type'   => 'nullable|in:permanent,contract,part_time',
            'bank_account_name' => 'nullable|string|max:255',
            'bank_account_no'   => 'nullable|string|max:30',
            'bank_ifsc'         => 'nullable|string|max:15',
            'bank_name'         => 'nullable|string|max:255',
            'pan'               => 'nullable|string|max:10',
            'pf_number'         => 'nullable|string|max:30',
            'esi_number'        => 'nullable|string|max:30',
            'is_pf_applicable'  => 'boolean',
            'is_esi_applicable' => 'boolean',
            'is_active'         => 'boolean',
        ]);

        $employee->update($validated);

        return response()->json(['data' => $employee->load(['department', 'designation'])]);
    }

    public function destroy(Employee $employee): JsonResponse
    {
        $this->authorize('delete', $employee);

        $employee->delete();

        return response()->json(['message' => 'Employee deleted']);
    }

    public function salaryStructure(Employee $employee): JsonResponse
    {
        $this->authorize('view', $employee);

        $structure = $employee->salaryStructure;

        return response()->json(['data' => $structure]);
    }
}
