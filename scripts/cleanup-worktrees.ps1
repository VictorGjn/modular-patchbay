# Cleanup stale git worktrees and merged branches
# Run from the repo root: .\scripts\cleanup-worktrees.ps1

$ErrorActionPreference = 'SilentlyContinue'

Write-Host "=== Removing stale worktree directories ===" -ForegroundColor Cyan
$dirs = Get-ChildItem -Path "$env:TEMP" -Directory -Filter "modular-issue-*"
$dirs += Get-ChildItem -Path "$env:TEMP" -Directory -Filter "mp-*"
foreach ($d in $dirs) {
    Write-Host "  Removing $($d.Name)..."
    Remove-Item $d.FullName -Recurse -Force
}

Write-Host "`n=== Pruning worktree refs ===" -ForegroundColor Cyan
git worktree prune

Write-Host "`n=== Deleting merged local branches ===" -ForegroundColor Cyan
$merged = git branch --merged master | ForEach-Object { $_.Trim() } | Where-Object { 
    $_ -ne 'master' -and $_ -ne '* master' -and $_ -notmatch '^\+'
}
foreach ($b in $merged) {
    Write-Host "  Deleting $b"
    git branch -D $b
}

Write-Host "`n=== Remaining branches ===" -ForegroundColor Cyan
git branch -a

Write-Host "`nDone." -ForegroundColor Green
