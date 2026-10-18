"""Validate source references against retrieved input."""


def validate_finding(finding, pull_request, guidelines=(), other_pull_requests=()):
    changed_files = {item.filename: item for item in pull_request.changed_files}
    guideline_files = {item.path: item for item in guidelines}
    pull_requests = {str(item.number): item for item in [pull_request, *other_pull_requests]}
    valid = []
    for ref in finding.evidence:
        source_text = None
        if ref.source_type == "changed_file" and ref.source in changed_files:
            source_text = changed_files[ref.source].patch or ""
        elif ref.source_type == "guideline" and ref.source in guideline_files:
            source_text = guideline_files[ref.source].content
        elif ref.source_type == "pull_request":
            pull = pull_requests.get(ref.source)
            if pull:
                source_text = "\n".join(filter(None, [pull.title, pull.body]))
            elif ref.source == "title":
                source_text = pull_request.title
            elif ref.source == "body":
                source_text = pull_request.body or ""
        if source_text is not None and (not ref.excerpt or ref.excerpt in source_text):
            valid.append(ref)
    if not valid:
        return None
    finding.evidence = valid
    return finding
